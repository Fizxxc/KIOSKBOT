import { randomUUID } from "crypto";
import type {
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramReplyMarkup,
  TelegramUpdate,
  TelegramUserFromBot,
} from "./types";
import { requireEnv } from "./utils";

const API_ROOT = "https://api.telegram.org/bot";

type TelegramResponse<T = unknown> = {
  ok: boolean;
  result: T;
  description?: string;
  parameters?: { retry_after?: number };
};

function token() {
  return requireEnv("BOT_TOKEN");
}

async function telegramRequest<T>(method: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${API_ROOT}${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as TelegramResponse<T>;
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
}

export function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
  parseMode: "HTML" | "Markdown" | undefined = undefined,
) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
    parse_mode: parseMode,
    disable_web_page_preview: !text.includes("http"),
  });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: Boolean(text),
  });
}

export function setWebhook(url: string, secretToken: string) {
  return telegramRequest("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
  });
}

export function getWebhookInfo() {
  return telegramRequest("getWebhookInfo");
}

export async function upsertTelegramUser(user: TelegramUserFromBot) {
  const supabase = (await import("./supabase/server")).createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("telegram_users")
    .upsert(
      {
        telegram_user_id: user.id,
        username: user.username ?? null,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        language_code: user.language_code ?? null,
        is_bot: user.is_bot,
        last_interaction_at: now,
      },
      { onConflict: "telegram_user_id" },
    );
  if (error) throw error;
}

export function mainMenuMarkup() {
  return {
    inline_keyboard: [
      [{ text: "🍽 Makanan", callback_data: "category_food" }],
      [{ text: "🥤 Minuman", callback_data: "category_drink" }],
      [
        { text: "📦 Pesanan Saya", callback_data: "my_orders" },
        { text: "ℹ️ Bantuan", callback_data: "help" },
      ],
    ],
  } satisfies TelegramReplyMarkup;
}

export function categoryMarkup(category: "food" | "drink") {
  return {
    inline_keyboard: [
      [{ text: "← Kembali ke Menu", callback_data: "menu" }],
    ],
  } satisfies TelegramReplyMarkup;
}

export function productMarkup(productId: string) {
  return {
    inline_keyboard: [
      [{ text: "Pilih Makanan Ini", callback_data: `product_${productId}` }],
      [{ text: "← Kembali", callback_data: `category_${productId.startsWith("p_") ? "food" : "food"}` }],
    ],
  } satisfies TelegramReplyMarkup;
}

export function quantityMarkup() {
  return {
    inline_keyboard: [
      [
        { text: "1", callback_data: "qty_1" },
        { text: "2", callback_data: "qty_2" },
        { text: "3", callback_data: "qty_3" },
      ],
      [{ text: "Ketik jumlah lain", callback_data: "qty_text" }],
      [{ text: "← Kembali", callback_data: "menu" }],
    ],
  } satisfies TelegramReplyMarkup;
}

export function sugarMarkup(levels: string[]) {
  const buttons = levels.map((level) => ({
    text: level === "less" ? "Less Sugar" : "Normal Sugar",
    callback_data: `sugar_${level}`,
  }));
  return {
    inline_keyboard: [buttons, [{ text: "← Kembali", callback_data: "menu" }]],
  } satisfies TelegramReplyMarkup;
}

export function paymentMarkup(paymentUrl: string, orderId: string) {
  return {
    inline_keyboard: [
      [{ text: "💳 Lanjut ke Pembayaran", url: paymentUrl }],
      [{ text: "🔄 Cek Pembayaran", callback_data: `check_payment_${orderId}` }],
      [{ text: "← Kembali ke Menu", callback_data: "menu" }],
    ],
  } satisfies TelegramReplyMarkup;
}

export function orderMarkup(orderId: string) {
  return {
    inline_keyboard: [
      [{ text: "🔄 Cek Pembayaran", callback_data: `check_payment_${orderId}` }],
      [{ text: "← Kembali ke Menu", callback_data: "menu" }],
    ],
  } satisfies TelegramReplyMarkup;
}

export function extractActor(update: TelegramUpdate): TelegramUserFromBot | null {
  return update.callback_query?.from ?? update.message?.from ?? update.edited_message?.from ?? null;
}

export function extractChatId(update: TelegramUpdate): number | null {
  return update.callback_query?.message?.chat.id ?? update.message?.chat.id ?? update.edited_message?.chat.id ?? null;
}

export function isCallback(update: TelegramUpdate): update is TelegramUpdate & { callback_query: TelegramCallbackQuery } {
  return Boolean(update.callback_query);
}

export function isMessage(update: TelegramUpdate): update is TelegramUpdate & { message: TelegramMessage } {
  return Boolean(update.message);
}

export function randomId(prefix = "id") {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}
