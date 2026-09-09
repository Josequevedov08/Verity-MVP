-- Antes: `address` era PRIMARY KEY en funded_wallets, es decir, cada
-- wallet se podía fondear UNA SOLA VEZ para siempre. Eso resultó
-- demasiado estricto en la práctica: sellar un lote grande puede
-- gastar de verdad el gas que se le dio, y esa wallet quedaba sin forma
-- de recibir más aunque el gasto haya sido legítimo (no abuso) —
-- reportado por el usuario probando sellado en lote real.
--
-- Se cambia a un id propio (permite varias filas por dirección) — el
-- límite real contra abuso pasa a ser un tope de recargas totales por
-- dirección (ver fund-wallet/index.ts: MAX_FUNDINGS_PER_ADDRESS),
-- combinado con el límite por IP que ya existía.
alter table public.funded_wallets drop constraint funded_wallets_pkey;
alter table public.funded_wallets add column id uuid primary key default gen_random_uuid();
create index funded_wallets_address_idx on public.funded_wallets (address);
