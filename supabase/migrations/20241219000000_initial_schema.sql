-- Consolidated initial schema for Bot Pesan system
-- Run this on a fresh Supabase database

create extension if not exists pgcrypto;

-- Profiles table (replaces admin_profiles)
-- Role defaults to 'user', can be 'user' or 'admin'
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  language_code text,
  is_bot boolean not null default false,
  is_blocked boolean not null default false,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null check (category in ('food', 'drink')),
  price_amount integer not null check (price_amount > 0),
  currency text not null default 'IDR' check (length(currency) = 3),
  stock integer not null default 0 check (stock >= 0),
  sugar_levels text[] not null default array['normal', 'less'],
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  telegram_user_id bigint not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'failed')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'waiting', 'settlement', 'capture', 'expire', 'cancel', 'deny', 'failed')),
  total_amount integer not null check (total_amount > 0),
  currency text not null default 'IDR' check (length(currency) = 3),
  midtrans_order_id text unique,
  snap_token text,
  payment_url text,
  snap_redirect_url text,
  midtrans_transaction_id text,
  payment_type text,
  fraud_status text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  category text not null check (category in ('food', 'drink')),
  quantity integer not null check (quantity > 0),
  sugar_level text,
  note text,
  unit_price integer not null check (unit_price > 0),
  subtotal integer not null check (subtotal > 0)
);

create table if not exists public.conversation_state (
  telegram_user_id bigint primary key,
  state text not null,
  context jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  image_url text,
  cta_label text,
  cta_url text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Broadcasts with paused state support
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  cta_label text,
  cta_url text,
  status text not null default 'draft' check (status in ('draft', 'running', 'completed', 'failed', 'paused')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  telegram_user_id bigint not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'retry')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (broadcast_id, telegram_user_id)
);

create table if not exists public.broadcast_send_jobs (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  total integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  remaining integer not null default 0,
  batch_size integer not null default 25,
  throttle_ms integer not null default 35,
  error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.bot_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('telegram', 'midtrans')),
  event_type text,
  payload jsonb,
  signature_valid boolean,
  processed boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists products_active_sort_idx on public.products(is_active, category, sort_order, created_at desc);
create index if not exists orders_telegram_idx on public.orders(telegram_user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at desc);
create index if not exists orders_midtrans_idx on public.orders(midtrans_order_id);
create index if not exists broadcast_recipients_pending_idx on public.broadcast_recipients(broadcast_id, status);
create index if not exists broadcast_send_jobs_broadcast_idx on public.broadcast_send_jobs(broadcast_id, created_at desc);
create index if not exists telegram_users_active_idx on public.telegram_users(is_blocked, created_at desc);

-- Functions
create or replace function public.create_order_from_cart(
  p_telegram_user_id bigint,
  p_product_id uuid,
  p_quantity integer,
  p_sugar_level text,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_total integer;
  v_order_json jsonb;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantity must be between 1 and 20';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and is_active = true
  for update;

  if not found then
    raise exception 'Product is unavailable';
  end if;

  if v_product.stock < p_quantity then
    raise exception 'Stock is insufficient';
  end if;

  if v_product.category = 'drink' and p_sugar_level is null then
    p_sugar_level := 'normal';
  end if;

  if v_product.category = 'drink' and not (p_sugar_level = any(v_product.sugar_levels)) then
    raise exception 'Sugar level is unavailable';
  end if;

  v_order_number := 'ORD-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_total := v_product.price_amount * p_quantity;

  insert into public.orders (
    order_number,
    telegram_user_id,
    status,
    payment_status,
    total_amount,
    currency,
    midtrans_order_id,
    expires_at
  ) values (
    v_order_number,
    p_telegram_user_id,
    'pending',
    'pending',
    v_total,
    v_product.currency,
    v_order_number,
    now() + interval '30 minutes'
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    category,
    quantity,
    sugar_level,
    note,
    unit_price,
    subtotal
  ) values (
    v_order_id,
    v_product.id,
    v_product.name,
    v_product.category,
    p_quantity,
    p_sugar_level,
    nullif(btrim(p_note), ''),
    v_product.price_amount,
    v_total
  );

  update public.products
  set stock = stock - p_quantity,
      updated_at = now()
  where id = v_product.id;

  select to_jsonb(o) into v_order_json
  from public.orders o
  where o.id = v_order_id;

  return v_order_json;
end;
$$;

create or replace function public.restore_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return;
  end if;

  if v_order.status <> 'pending' and v_order.payment_status not in ('pending', 'waiting') then
    return;
  end if;

  for v_item in select * from public.order_items where order_id = p_order_id loop
    update public.products
    set stock = stock + v_item.quantity,
        updated_at = now()
    where id = v_item.product_id;
  end loop;

  update public.orders
  set status = 'cancelled',
      payment_status = 'cancel',
      updated_at = now()
  where id = p_order_id;
end;
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.telegram_users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.conversation_state enable row level security;
alter table public.ads enable row level security;
alter table public.broadcasts enable row level security;
alter table public.broadcast_recipients enable row level security;
alter table public.broadcast_send_jobs enable row level security;
alter table public.bot_settings enable row level security;
alter table public.webhook_logs enable row level security;

-- Policies
create policy "Admin full access to profiles" on public.profiles
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to telegram users" on public.telegram_users
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Active products are public" on public.products
for select using (is_active = true);

create policy "Admin full access to products" on public.products
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to orders" on public.orders
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to order items" on public.order_items
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to conversation state" on public.conversation_state
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Active ads are public" on public.ads
for select using (is_active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));

create policy "Admin full access to ads" on public.ads
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to broadcasts" on public.broadcasts
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to broadcast recipients" on public.broadcast_recipients
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to broadcast send jobs" on public.broadcast_send_jobs
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to bot settings" on public.bot_settings
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to webhook logs" on public.webhook_logs
for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Initial bot settings
insert into public.bot_settings (key, value) values
  ('welcome', '{"text":"Halo! Selamat datang di Bot Pesan. Pilih menu di bawah untuk mulai memesan."}'::jsonb),
  ('menu', '{"text":"Silakan pilih kategori menu:"}'::jsonb),
  ('payment_success', '{"text":"Pembayaran berhasil. Terima kasih, pesanan Anda sedang diproses."}'::jsonb),
  ('webhook_status', '{"enabled": true, "secret_token_set": true, "last_sync_at": null, "last_error": null, "last_ok_at": null}'::jsonb),
  ('webhook_config', '{"url": "", "secret_token": "", "allowed_updates": ["message", "callback_query"]}'::jsonb),
  ('bot_info', '{"username": "", "first_name": "", "id": null}'::jsonb),
  ('broadcast_defaults', '{"batch_size": 25, "throttle_ms": 35, "max_retries": 2, "parse_mode": "HTML"}'::jsonb)
on conflict (key) do nothing;

-- Indexes
create index if not exists products_active_sort_idx on public.products(is_active, category, sort_order, created_at desc);
create index if not exists orders_telegram_idx on public.orders(telegram_user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at desc);
create index if not exists orders_midtrans_idx on public.orders(midtrans_order_id);
create index if not exists broadcast_recipients_pending_idx on public.broadcast_recipients(broadcast_id, status);
create index if not exists broadcast_send_jobs_broadcast_idx on public.broadcast_send_jobs(broadcast_id, created_at desc);
create index if not exists telegram_users_active_idx on public.telegram_users(is_blocked, created_at desc);