-- Financiamiento automático de wallets nuevas (Polygon Amoy testnet).
-- Resuelve un problema real de producto: sin esto, un usuario que instala
-- Verity de cero tendría que ir manualmente a un faucet externo, copiar su
-- dirección y resolver un captcha solo para poder sellar su primera foto —
-- rompe la promesa de "wallet invisible" que sostiene toda la app. En su
-- lugar, una wallet propia del proyecto (fondeada una sola vez por
-- nosotros, clave en Vault — secret "verity_funder_private_key") le manda
-- una gotita de POL de prueba a cada wallet nueva automáticamente, en
-- silencio, desde la Edge Function fund-wallet.

-- Cada dirección se fondea UNA SOLA VEZ para siempre — evita que alguien
-- pida financiamiento repetido a la misma wallet una vez que ya tiene
-- saldo.
create table public.funded_wallets (
  address text primary key,
  tx_hash text not null,
  amount_wei text not null,
  funded_at timestamptz not null default now()
);

alter table public.funded_wallets enable row level security;
-- Nadie lee ni escribe esto directo con la clave pública — solo la Edge
-- Function fund-wallet, que corre con la service role.

-- Límite por IP: evita que alguien genere miles de wallets nuevas y pida
-- financiamiento en cadena para vaciar el fondo del proyecto.
create table public.fund_requests_log (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  address text not null,
  requested_at timestamptz not null default now()
);

alter table public.fund_requests_log enable row level security;

create index fund_requests_log_ip_time_idx on public.fund_requests_log (ip, requested_at desc);

-- El esquema "vault" no está expuesto por PostgREST, así que la Edge
-- Function no puede leer vault.decrypted_secrets con un simple
-- .from(...). Esta función SECURITY DEFINER expone SOLO el valor
-- descifrado de UN secreto por nombre, y solo puede ejecutarla el
-- service_role (la Edge Function usa la service role key) — nunca el rol
-- anónimo/público.
create or replace function public.get_decrypted_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  limit 1;
$$;

revoke all on function public.get_decrypted_secret(text) from public, anon, authenticated;
grant execute on function public.get_decrypted_secret(text) to service_role;
