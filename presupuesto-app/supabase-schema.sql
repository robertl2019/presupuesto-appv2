-- ============================================================
-- PRESUPUESTO APP — Supabase Schema v2 (desc → descripcion)
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── INGRESOS ────────────────────────────────────────────────
create table if not exists ingresos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  descripcion text not null,
  cat         text default 'Otro',
  monto       numeric(12,2) default 0,
  fecha       date default current_date,
  nota        text default '',
  created_at  timestamptz default now()
);
alter table ingresos enable row level security;
create policy "own ingresos" on ingresos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── GASTOS ──────────────────────────────────────────────────
create table if not exists gastos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  descripcion text not null,
  cat         text default 'Otros',
  estado      text default 'pendiente',
  pagado      numeric(12,2) default 0,
  prev        numeric(12,2) default 0,
  real        numeric(12,2) default 0,
  fecha       date default current_date,
  nota        text default '',
  prio        text default 'media',
  created_at  timestamptz default now()
);
alter table gastos enable row level security;
create policy "own gastos" on gastos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── MERCADO ─────────────────────────────────────────────────
create table if not exists mercado (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  sec         text default 'Supermercado',
  prod        text not null,
  qty         numeric(8,2) default 1,
  und         text default 'und',
  price       numeric(12,2) default 0,
  created_at  timestamptz default now()
);
alter table mercado enable row level security;
create policy "own mercado" on mercado for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── DEUDAS ──────────────────────────────────────────────────
create table if not exists deudas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  nombre      text not null,
  total       numeric(12,2) default 0,
  cuota       numeric(12,2) default 0,
  pagado      numeric(12,2) default 0,
  venc        date,
  estado      text default 'activa',
  created_at  timestamptz default now()
);
alter table deudas enable row level security;
create policy "own deudas" on deudas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── APPS ────────────────────────────────────────────────────
create table if not exists apps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  nombre      text not null,
  monto       numeric(12,2) default 0,
  ciclo       text default 'mensual',
  cat         text default 'Otro',
  estado      text default 'activa',
  nota        text default '',
  created_at  timestamptz default now()
);
alter table apps enable row level security;
create policy "own apps" on apps for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
