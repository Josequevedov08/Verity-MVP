# Backend — índice público de certificados

Resuelve el límite descrito en el README principal: sin esto, un certificado
sellado en OTRO dispositivo solo se podía confirmar si quien lo selló te
pasaba a mano su número de sello (el hash de la transacción de anclaje).

## Qué es (y qué NO es)

Un índice de **solo metadatos**, no un servidor de Verity con lógica de
negocio. Guarda exactamente lo que ya es público una vez que un hash queda
anclado en Polygon Amoy — hash, número de sello, tx, wallet, nivel de
confianza, tipo de medio, fecha — y **nunca** el archivo original ni una
miniatura. Si esta base de datos desapareciera mañana, ningún sello dejaría
de ser válido: la verdad sigue viviendo en la blockchain. Esto solo hace más
fácil *encontrar* esa verdad sin tener el número de sello a mano.

## Infraestructura

- **Proyecto Supabase**: `verity-mvp` (Postgres + Edge Functions), plan
  gratis ($0/mes).
- **Tabla `certificates`** (`supabase/migrations/0001_create_public_certificates_index.sql`):
  RLS activado, lectura pública (`select` para `anon`/`authenticated`),
  **sin política de escritura** — nadie puede insertar directo con la clave
  pública.
- **Edge Function `submit-certificate`** (`supabase/functions/submit-certificate/index.ts`):
  único camino de escritura. Antes de guardar nada, lee la transacción
  directo de Polygon Amoy (RPC público, sin API key) y confirma que:
  1. Es una transacción de **valor 0** de la wallet **hacia sí misma**
     (la forma exacta que usa `blockchainService.ts` para anclar).
  2. Su campo `data` es **exactamente** el hash SHA-256 recibido.

  Solo si las tres cosas son ciertas, inserta la fila — con
  `ON CONFLICT (sha256) DO NOTHING`, así que el primer registro de un hash
  gana y un reenvío posterior con metadatos distintos para el mismo hash se
  ignora en silencio (mitiga que alguien reenvíe un anclaje real ajeno con
  un nivel de confianza o número de sello inventado).

  `verify_jwt: false` a propósito — Verity no tiene login, así que no hay
  JWT de usuario que exigir; la verificación real es la de la cadena, no la
  de una sesión.

## Financiamiento automático de wallets nuevas (gas)

Resuelve otro límite real: sin esto, un usuario que instala la app de cero
necesitaría salir a un faucet externo (con captcha) para conseguir POL de
prueba antes de poder sellar su primera foto — rompe la promesa de "wallet
invisible".

- **Tablas `funded_wallets` y `fund_requests_log`** (`supabase/migrations/0002_create_wallet_funding.sql`,
  `0003_allow_multiple_fundings_per_wallet.sql`): RLS activado, sin
  política de lectura/escritura pública — solo la Edge Function
  (service role) las toca. `funded_wallets` limita cada dirección a un
  máximo de `MAX_FUNDINGS_PER_ADDRESS` recargas de por vida (antes era
  una sola vez para siempre, pero resultó demasiado estricto: sellar un
  lote grande puede gastar de verdad el gas dado, sin que eso sea
  abuso); `fund_requests_log` lleva un límite de 3 pedidos por IP cada
  10 minutos.
- **Secreto `verity_funder_private_key`** en Supabase Vault: la clave
  privada de la wallet "financiadora" del proyecto (fondeada manualmente,
  vía el faucet oficial de Amoy, recargable cuando haga falta). Se lee
  desde la Edge Function a través de la función
  `public.get_decrypted_secret(name)` (`SECURITY DEFINER`, solo
  ejecutable por `service_role`), porque el esquema `vault` no está
  expuesto directamente por PostgREST.
- **Edge Function `fund-wallet`** (`supabase/functions/fund-wallet/index.ts`):
  recibe una dirección, y si (a) no superó su tope de recargas, (b) no
  supera el límite por IP, y (c) su saldo on-chain actual es ~0, le manda
  0.05 POL desde la wallet financiadora del proyecto.
- Se llama automáticamente desde `app/services/blockchainService.ts`
  (`ensureWalletHasGas`) justo antes de anclar, solo si el saldo local es
  bajo — en silencio, sin ninguna acción del usuario.

## Cómo se usa desde la app

- `app/services/verificationIndexService.ts`:
  - `submitToPublicIndex(certificate)` — se llama automáticamente al sellar
    (ver `CaptureScreen.tsx`), **fire-and-forget**: si falla (sin internet,
    índice caído), el sellado en sí no se ve afectado — el anclaje en
    Polygon ya es válido de todas formas.
  - `lookupInPublicIndex(sha256)` — se usa en "Verificar" (`VerificationScreen.tsx`)
    como respaldo cuando el archivo no está en el historial local de ese
    dispositivo.

## Página pública de verificación

`docs/index.html` — página estática (sin build, sin dependencias), pensada
para publicarse con **GitHub Pages** directo desde esta rama
(Settings → Pages → Deploy from a branch → `main` → carpeta `/docs`).
Deja verificar un archivo o un número de sello **sin instalar la app**: el
hash se calcula en el propio navegador (Web Crypto API) y solo eso se
consulta contra Supabase / Polygon Amoy.

## Variables de entorno (app)

Ver `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=https://lxzmegutqorsmnoonkyv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

La "anon key" es una clave **publicable** (pensada para exponerse en un
cliente) — no es un secreto; la seguridad real la da RLS + la Edge Function,
no ocultar esta clave.

## Reproducir desde cero

1. Crear un proyecto en Supabase.
2. Correr `supabase/migrations/0001_create_public_certificates_index.sql`.
3. Desplegar `supabase/functions/submit-certificate/index.ts` como Edge
   Function con `verify_jwt` desactivado.
4. Copiar la URL del proyecto y la "publishable key" a `.env`.
5. Correr `supabase/migrations/0002_create_wallet_funding.sql`.
6. Generar una wallet nueva (la "financiadora"), guardar su clave privada
   en Vault con el nombre `verity_funder_private_key`, y fondearla una
   sola vez, manualmente, con el faucet de https://faucet.polygon.technology/
   (red "Amoy").
7. Desplegar `supabase/functions/fund-wallet/index.ts` como Edge Function
   con `verify_jwt` desactivado.
