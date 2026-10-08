-- ============================================================
-- MIGRACIÓN v3 — Medio de pago + Mercado est/real
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================================

-- ─── GASTOS: medio de pago y comisión ────────────────────────
alter table gastos add column if not exists medio_pago  text          default 'Efectivo';
alter table gastos add column if not exists comision    numeric(5,2)  default 0;
alter table gastos add column if not exists fecha_cobro date;

-- ─── MERCADO: precio estimado vs real ────────────────────────
alter table mercado add column if not exists price_est  numeric(12,2) default 0;
alter table mercado add column if not exists price_real numeric(12,2) default 0;
