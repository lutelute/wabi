-- wabi_data: ユーザーごとのデータ保存 (1レコード = 1データキー)
create table if not exists wabi_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  data_key text not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  unique(user_id, data_key)
);

-- インデックス
create index if not exists idx_wabi_data_user on wabi_data(user_id);
create index if not exists idx_wabi_data_user_key on wabi_data(user_id, data_key);

-- RLS: ユーザーは自分のデータのみアクセス可能
alter table wabi_data enable row level security;

create policy "Users can select own data" on wabi_data
  for select using (auth.uid() = user_id);

create policy "Users can insert own data" on wabi_data
  for insert with check (auth.uid() = user_id);

create policy "Users can update own data" on wabi_data
  for update using (auth.uid() = user_id);

create policy "Users can delete own data" on wabi_data
  for delete using (auth.uid() = user_id);
