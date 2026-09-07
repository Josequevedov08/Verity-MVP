-- Índice público mínimo de certificados de Verity.
-- Guarda SOLO metadatos públicos ya visibles en la blockchain (el hash, el
-- número de sello, el tx de anclaje, nivel de confianza y tipo de medio) —
-- NUNCA el archivo original ni una miniatura. Su único propósito: permitir
-- verificar un archivo sellado desde OTRO dispositivo sin tener que escribir
-- el número de sello a mano, buscando por el hash calculado localmente.
create table public.certificates (
  sha256 text primary key,
  tx_hash text not null,
  wallet_address text not null,
  sequence_number text,
  trust_level text not null check (trust_level in ('ALTO', 'MEDIO', 'BAJO')),
  media_type text not null check (media_type in ('image', 'video')),
  sealed_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.certificates is
  'Índice público de sellos de Verity — solo metadatos, nunca el archivo original. Ver documentation/technical/verity-protocol.ts y backend/README.md.';

alter table public.certificates enable row level security;

-- Cualquiera puede consultar (es lo que hace posible verificar desde otro
-- dispositivo) — ningún dato sensible vive en esta tabla.
create policy "Cualquiera puede leer el índice público"
  on public.certificates for select
  to anon, authenticated
  using (true);

-- Nadie escribe directo con la anon key: solo la Edge Function
-- submit-certificate (que corre con la service role, después de verificar
-- el anclaje real en Polygon Amoy) puede insertar filas.
