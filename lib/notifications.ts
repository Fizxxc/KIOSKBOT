import { createSupabaseAdminClient } from "./supabase/server";
import { sendMessage } from "./telegram";
import { formatRupiah } from "./utils";

export async function sendPaymentNotification(orderUuid: string) {
  const db = createSupabaseAdminClient();
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderUuid)
    .single();
  if (orderError || !order) return;

  const { data: user } = await db
    .from("telegram_users")
    .select("telegram_user_id")
    .eq("telegram_user_id", order.telegram_user_id)
    .maybeSingle();
  if (!user) return;

  const item = order.order_items?.[0];
  const success = order.status === "paid";
  const failed = order.status === "failed" || order.status === "cancelled";
  const title = success
    ? "✅ Pembayaran berhasil"
    : failed
      ? "❌ Pembayaran tidak berhasil"
      : "⏳ Status pembayaran diperbarui";
  const body = success
    ? "Terima kasih! Pesanan Anda telah dibayar dan sedang diproses."
    : failed
      ? "Pembayaran tidak berhasil. Silakan buat pesanan baru dari menu."
      : `Status pembayaran saat ini: ${order.payment_status}.`;
  const details = item
    ? `\n\n${item.product_name}\nJumlah: ${item.quantity}${item.sugar_level ? `\nTingkat gula: ${item.sugar_level}` : ""}${item.note ? `\nCatatan: ${item.note}` : ""}\nTotal: ${formatRupiah(order.total_amount)}`
    : "";

  await sendMessage(
    user.telegram_user_id,
    `${title}\n\nPesanan ${order.order_number}\n${body}${details}`,
    undefined,
    "HTML",
  );
}
