export type Category = "food" | "drink";

export type Product = {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  price_amount: number;
  currency: string;
  stock: number;
  sugar_levels: string[];
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TelegramUser = {
  id: string;
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  is_bot: boolean;
  is_blocked: boolean;
  last_interaction_at: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  telegram_user_id: number;
  status: "pending" | "paid" | "cancelled" | "failed";
  payment_status: string;
  total_amount: number;
  currency: string;
  midtrans_order_id: string | null;
  snap_token: string | null;
  payment_url: string | null;
  midtrans_transaction_id: string | null;
  payment_type: string | null;
  fraud_status: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  category: Category;
  quantity: number;
  sugar_level: string | null;
  note: string | null;
  unit_price: number;
  subtotal: number;
};

export type Ad = {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Broadcast = {
  id: string;
  title: string;
  message: string;
  cta_label: string | null;
  cta_url: string | null;
  status: "draft" | "running" | "completed" | "failed" | "paused";
  sent_count: number;
  failed_count: number;
  pending_count?: number;
  total_recipients?: number;
  created_at: string;
  completed_at: string | null;
};

export type BroadcastRecipient = {
  id: string;
  broadcast_id: string;
  telegram_user_id: number;
  status: "pending" | "sent" | "failed" | "retry";
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

export type BroadcastSendJob = {
  id: string;
  broadcast_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  batch_size: number;
  throttle_ms: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type BotSettings = {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
};

export type TelegramUserFromBot = {
  id: number;
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string; title?: string };
  from?: TelegramUserFromBot;
  text?: string;
  date?: number;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUserFromBot;
  data: string;
  message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type TelegramKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type TelegramReplyMarkup = {
  inline_keyboard?: TelegramKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
};
