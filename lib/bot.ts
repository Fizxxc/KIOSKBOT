import { createSupabaseAdminClient } from "./supabase/server";
import {
  answerCallbackQuery,
  categoryMarkup,
  extractActor,
  extractChatId,
  mainMenuMarkup,
  orderMarkup,
  paymentMarkup,
  quantityMarkup,
  sendMessage,
  sugarMarkup,
  upsertTelegramUser,
} from "./telegram";
import { createSnapTransaction, syncPaymentByOrderUuid } from "./midtrans";
import { formatRupiah, getPublicBaseUrl } from "./utils";
import { sendPaymentNotification } from "./notifications";
import type { Order, Product, TelegramCallbackQuery, TelegramMessage } from "./types";

type ConversationState =
  | "menu"
  | "selecting_quantity"
  | "awaiting_quantity_text"
  | "selecting_sugar"
  | "awaiting_note"
  | "awaiting_payment";

type ConversationRecord = {
  telegram_user_id: number;
  state: ConversationState;
  context: Record<string, unknown>;
};

const supabase = () => createSupabaseAdminClient();

function html(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function getConversation(telegramUserId: number): Promise<ConversationRecord | null> {
  const { data } = await supabase()
    .from("conversation_state")
    .select("telegram_user_id, state, context")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  return data as ConversationRecord | null;
}

async function setConversation(telegramUserId: number, state: ConversationState, context: Record<string, unknown> = {}) {
  const { error } = await supabase()
    .from("conversation_state")
    .upsert(
      { telegram_user_id: telegramUserId, state, context },
      { onConflict: "telegram_user_id" },
    );
  if (error) throw error;
}

async function updateConversationContext(telegramUserId: number, patch: Record<string, unknown>) {
  const current = await getConversation(telegramUserId);
  await setConversation(telegramUserId, current?.state ?? "menu", { ...(current?.context ?? {}), ...patch });
}

async function setting(key: string, fallback: string) {
  const { data } = await supabase()
    .from("bot_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const value = data?.value as { text?: string } | null;
  return value?.text || fallback;
}

async function activeAd() {
  const { data } = await supabase()
    .from("ads")
    .select("title, message, cta_label, cta_url, starts_at, ends_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(10);
  const now = Date.now();
  return (data || []).find((ad) => {
    const starts = ad.starts_at ? new Date(ad.starts_at).getTime() : null;
    const ends = ad.ends_at ? new Date(ad.ends_at).getTime() : null;
    return (!starts || starts <= now) && (!ends || ends >= now);
  }) || null;
}

async function sendMenu(chatId: number, telegramUserId: number) {
  const [text, ad] = await Promise.all([
    setting("welcome", "Halo! Selamat datang di Bot Pesan. Silakan pilih menu di bawah."),
    activeAd(),
  ]);
  const adText = ad ? `\n\n📢 <b>${html(ad.title)}</b>\n${html(ad.message)}` : "";
  await setConversation(telegramUserId, "menu", {});
  await sendMessage(chatId, `${html(text)}${adText}`, mainMenuMarkup(), "HTML");
}

async function sendCategory(chatId: number, telegramUserId: number, category: "food" | "drink") {
  const { data: products, error } = await supabase()
    .from("products")
    .select("id, name, description, price_amount, currency, stock, sugar_levels, image_url")
    .eq("category", category)
    .eq("is_active", true)
    .gt("stock", 0)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;

  const title = category === "food" ? "🍽 <b>Menu Makanan</b>" : "🥤 <b>Menu Minuman</b>";
  if (!products?.length) {
    await sendMessage(chatId, `${title}\n\nMenu sedang kosong. Silakan coba kategori lain.`, categoryMarkup(category), "HTML");
    return;
  }

  const keyboard = products.slice(0, 10).map((product) => [
    { text: `${product.name} — ${formatRupiah(product.price_amount)}`, callback_data: `product_${product.id}` },
  ]);
  keyboard.push([{ text: "← Kembali ke Menu", callback_data: "menu" }]);
  const items = products
    .slice(0, 10)
    .map((product) => `• *${product.name}* — ${formatRupiah(product.price_amount)}\n  Stok: ${product.stock}`)
    .join("\n");
  await sendMessage(chatId, `${title}\n\n${items}`, { inline_keyboard: keyboard }, "HTML");
}

async function sendProductDetail(chatId: number, telegramUserId: number, productId: string) {
  const { data: product, error } = await supabase()
    .from("products")
    .select("id, name, description, category, price_amount, currency, stock, sugar_levels")
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!product || product.stock < 1) {
    await sendMessage(chatId, "Maaf, menu ini sedang tidak tersedia.", mainMenuMarkup());
    return;
  }

  await setConversation(telegramUserId, "selecting_quantity", { product_id: product.id, quantity: 1 });
  const sugar = product.category === "drink" ? `\nPilihan gula: ${product.sugar_levels?.join(" / ") || "normal"}` : "";
  await sendMessage(
    chatId,
    `*${html(product.name)}*\n${html(product.description || "Menu favorit siap dipesan.")}\n\nHarga: ${formatRupiah(product.price_amount)}\nStok: ${product.stock}${html(sugar)}\n\nPilih jumlah pesanan:`,
    quantityMarkup(),
    "HTML",
  );
}

async function askNote(chatId: number, telegramUserId: number) {
  const conversation = await getConversation(telegramUserId);
  await setConversation(telegramUserId, "awaiting_note", conversation?.context ?? {});
  await sendMessage(
    chatId,
    "Catatan untuk pesanan? Contoh: tanpa es, pedas sedang, atau kosongkan jika tidak ada.\n\nKirim catatan atau klik tombol di bawah.",
    {
      inline_keyboard: [[{ text: "Lewati catatan", callback_data: "skip_note" }]],
    },
  );
}

async function createPaidOrder(chatId: number, telegramUserId: number, note?: string | null) {
  const conversation = await getConversation(telegramUserId);
  const productId = String(conversation?.context.product_id ?? "");
  const quantity = Number(conversation?.context.quantity ?? 1);
  const sugarLevel = String(conversation?.context.sugar_level ?? "");
  if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    await sendMessage(chatId, "Pesanan tidak lengkap. Silakan mulai dari menu.", mainMenuMarkup());
    await setConversation(telegramUserId, "menu", {});
    return;
  }

  const db = supabase();
  const { data: created, error: createError } = await db.rpc("create_order_from_cart", {
    p_telegram_user_id: telegramUserId,
    p_product_id: productId,
    p_quantity: quantity,
    p_sugar_level: sugarLevel || null,
    p_note: note ?? null,
  });
  if (createError || !created) {
    await sendMessage(chatId, `Pesanan belum bisa dibuat: ${html(createError?.message || "coba beberapa saat lagi.")}`, mainMenuMarkup());
    await setConversation(telegramUserId, "menu", {});
    return;
  }

  const { data: order } = await db
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", created.id)
    .single();
  const { data: customer } = await db
    .from("telegram_users")
    .select("first_name, username")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (!order) {
    await sendMessage(chatId, "Pesanan belum bisa dibuat. Silakan ulangi.", mainMenuMarkup());
    await setConversation(telegramUserId, "menu", {});
    return;
  }

  try {
    const snap = await createSnapTransaction(order as Order, {
      firstName: customer?.first_name,
      username: customer?.username,
    });
    const paymentPageUrl = `${getPublicBaseUrl()}/pay/${encodeURIComponent(order.order_number)}`;
    const { error: updateError } = await db
      .from("orders")
      .update({ snap_token: snap.token, payment_url: paymentPageUrl, snap_redirect_url: snap.redirect_url, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (updateError) throw updateError;

    await setConversation(telegramUserId, "awaiting_payment", { order_id: order.id });
    await sendMessage(
      chatId,
      `Pesanan *${html(order.order_number)}* dibuat.\n\nTotal: *${formatRupiah(order.total_amount)}*\n\nKlik tombol pembayaran untuk melanjutkan. Setelah pembayaran berhasil, bot akan mengirim konfirmasi otomatis.`,
      paymentMarkup(paymentPageUrl, order.id),
      "HTML",
    );
  } catch (error) {
    await db.rpc("restore_order_stock", { p_order_id: order.id });
    await sendMessage(chatId, `Pembayaran belum bisa dibuat: ${html(error instanceof Error ? error.message : "coba lagi nanti.")}`, mainMenuMarkup());
    await setConversation(telegramUserId, "menu", {});
  }
}

async function sendMyOrders(chatId: number, telegramUserId: number) {
  const { data: orders, error } = await supabase()
    .from("orders")
    .select("id, order_number, status, payment_status, total_amount, currency, created_at")
    .eq("telegram_user_id", telegramUserId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  if (!orders?.length) {
    await sendMessage(chatId, "Belum ada pesanan. Yuk pilih menu favoritmu!", mainMenuMarkup());
    return;
  }
  const keyboard = orders.slice(0, 5).map((order) => [
    { text: `${order.order_number} — ${order.status === "paid" ? "Lunas" : "Menunggu"}`, callback_data: `check_payment_${order.id}` },
  ]);
  keyboard.push([{ text: "← Kembali ke Menu", callback_data: "menu" }]);
  const lines = orders.map((order) => `${order.order_number} — ${formatRupiah(order.total_amount)} — ${order.status === "paid" ? "✅ Lunas" : "⏳ Menunggu"}`).join("\n");
  await sendMessage(chatId, `📦 <b>Riwayat pesanan</b>\n\n${html(lines)}`, { inline_keyboard: keyboard }, "HTML");
}

async function handleCheckPayment(chatId: number, orderId: string) {
  try {
    const result = await syncPaymentByOrderUuid(orderId);
    if (!result) {
      await sendMessage(chatId, "Pesanan tidak ditemukan.", mainMenuMarkup());
      return;
    }
    const label = result.orderStatus === "paid" ? "✅ Pembayaran berhasil" : result.orderStatus === "failed" ? "❌ Pembayaran gagal" : "⏳ Pembayaran masih menunggu";
    await sendMessage(chatId, `${label}\n\nPesanan ${result.order_number} akan terus dipantau. Bot akan mengirim notifikasi otomatis ketika status berubah.`, orderMarkup(orderId));
    if (result.shouldNotify) {
      await sendPaymentNotification(orderId);
    }
  } catch {
    await sendMessage(chatId, "Status pembayaran belum bisa dicek. Silakan coba beberapa saat lagi.", orderMarkup(orderId));
  }
}

async function handleCallback(callback: TelegramCallbackQuery, chatId: number, telegramUserId: number) {
  await answerCallbackQuery(callback.id);
  const [action, ...rest] = callback.data.split("_");
  if (action === "menu") return sendMenu(chatId, telegramUserId);
  if (action === "category" && (rest[0] === "food" || rest[0] === "drink")) return sendCategory(chatId, telegramUserId, rest[0]);
  if (action === "product") return sendProductDetail(chatId, telegramUserId, rest.join("_"));
  if (action === "qty" && rest[0] === "text") {
    await setConversation(telegramUserId, "awaiting_quantity_text");
    return sendMessage(chatId, "Ketik jumlah pesanan dalam angka 1–20.");
  }
  if (action === "qty") {
    const quantity = Number(rest[0]);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return sendMessage(chatId, "Jumlah tidak valid.");
    const conversation = await getConversation(telegramUserId);
    const { data: product } = await supabase()
      .from("products")
      .select("category, sugar_levels")
      .eq("id", String(conversation?.context.product_id ?? ""))
      .maybeSingle();
    await updateConversationContext(telegramUserId, { quantity });
    if (product?.category === "drink") {
      await setConversation(telegramUserId, "selecting_sugar");
      return sendMessage(chatId, "Pilih tingkat gula:", sugarMarkup(product.sugar_levels || ["normal", "less"]));
    }
    return askNote(chatId, telegramUserId);
  }
  if (action === "sugar") {
    await updateConversationContext(telegramUserId, { sugar_level: rest[0] });
    return askNote(chatId, telegramUserId);
  }
  if (action === "skip_note") return createPaidOrder(chatId, telegramUserId, "");
  if (action === "my_orders") return sendMyOrders(chatId, telegramUserId);
  if (action === "check" && rest[0] === "payment") return handleCheckPayment(chatId, rest.slice(1).join("_"));
  if (action === "help") {
    await setConversation(telegramUserId, "menu", {});
    return sendMessage(chatId, "Cara memesan:\n1. Pilih Makanan atau Minuman\n2. Pilih menu\n3. Pilih jumlah dan tingkat gula jika ada\n4. Tambahkan catatan opsional\n5. Lanjutkan ke pembayaran\n\nButuh bantuan? Hubungi admin toko.", mainMenuMarkup());
  }
  return sendMenu(chatId, telegramUserId);
}

async function handleMessage(message: TelegramMessage, chatId: number, telegramUserId: number) {
  const text = message.text?.trim();
  if (!text) return;
  if (text === "/start" || text === "/menu") return sendMenu(chatId, telegramUserId);
  if (text === "/help") {
    await setConversation(telegramUserId, "menu", {});
    return sendMessage(chatId, "Pilih menu di bawah untuk mulai memesan.", mainMenuMarkup());
  }

  const conversation = await getConversation(telegramUserId);
  if (conversation?.state === "awaiting_quantity_text") {
    const quantity = Number(text);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return sendMessage(chatId, "Jumlah tidak valid. Kirim angka 1–20.");
    const { data: product } = await supabase()
      .from("products")
      .select("category, sugar_levels")
      .eq("id", String(conversation.context.product_id ?? ""))
      .maybeSingle();
    await updateConversationContext(telegramUserId, { quantity });
    if (product?.category === "drink") {
      await setConversation(telegramUserId, "selecting_sugar");
      return sendMessage(chatId, "Pilih tingkat gula:", sugarMarkup(product.sugar_levels || ["normal", "less"]));
    }
    return askNote(chatId, telegramUserId);
  }

  if (conversation?.state === "awaiting_note") return createPaidOrder(chatId, telegramUserId, text);
  return sendMenu(chatId, telegramUserId);
}

export async function handleTelegramUpdate(update: { update_id?: number; message?: TelegramMessage; edited_message?: TelegramMessage; callback_query?: TelegramCallbackQuery }) {
  const actor = extractActor(update as never);
  const chatId = extractChatId(update as never);
  if (!actor || !chatId || actor.is_bot) return;
  await upsertTelegramUser(actor);

  if (update.callback_query) {
    await handleCallback(update.callback_query, chatId, actor.id);
  } else if (update.message || update.edited_message) {
    await handleMessage(update.message || update.edited_message!, chatId, actor.id);
  }
}
