// fund-wallet
// ---------------------------------------------------------------------------
// Da a una wallet NUEVA de Verity una "gotita" de POL de prueba (Polygon
// Amoy testnet) automáticamente, en silencio, la primera vez que la
// necesita — para que el usuario NUNCA tenga que salir de la app a un
// faucet externo, copiar su dirección a mano y resolver un captcha solo
// para poder sellar su primera foto. Eso rompería la promesa central de
// Verity de una "wallet invisible".
//
// La wallet que paga este gas es una wallet propia del proyecto (el
// "funder"), fondeada UNA sola vez por nosotros vía el faucet oficial de
// Amoy. Su clave privada vive SOLO en Supabase Vault (secret
// "verity_funder_private_key") — nunca en el cliente, nunca en el repo.
//
// Protecciones contra abuso (alguien tratando de vaciar el fondo del
// proyecto generando wallets nuevas sin parar):
//   1. `funded_wallets`: cada dirección puede recibir hasta
//      MAX_FUNDINGS_PER_ADDRESS recargas en su vida — antes era una
//      sola vez para siempre, pero resultó demasiado estricto: sellar
//      un lote grande puede gastar de verdad el gas dado, sin que eso
//      sea abuso. Un tope (en vez de ilimitado) sigue acotando el
//      daño máximo posible por dirección.
//   2. `fund_requests_log` + límite por IP: como no hay login, la IP de
//      origen es la única señal disponible — máx. 3 pedidos por IP cada
//      10 minutos.
//   3. Solo se fondea si el balance on-chain de la wallet es ~0 — así
//      una wallet que ya tiene POL (por ejemplo, alguien reinstalando la
//      app con la misma keystore) no puede pedir más.
//
// Desplegado en el proyecto Supabase "verity-mvp" vía MCP — este archivo
// es la copia versionada en el repo para referencia/reproducibilidad.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ethers } from 'npm:ethers@6';

const AMOY_RPC_URL = 'https://polygon-amoy-bor-rpc.publicnode.com';

// Subido de nuevo a 0.01 POL (11 sep) ahora que el funder se recuperó
// a ~0.43 POL (ver [[verity-gas-funder]]) usando el truco de wallets
// puente + faucets. Un seal real gasta ~0.00024 POL, así que 0.01 POL
// cubre unos 41 sellos de colchón por wallet — más que el límite
// gratis de 30/mes, para que a un tester no se le corte el gas a
// mitad de mes por casualidad. Con este monto el funder alcanza para
// ~43 instalaciones nuevas antes de necesitar otra recarga. Bajarlo
// de nuevo (ver historial de este archivo) solo si el funder vuelve
// a quedar crítico.
const FUNDING_AMOUNT_WEI = ethers.parseEther('0.01');

// Si la wallet ya tiene al menos esto, no se le manda nada.
const MIN_BALANCE_THRESHOLD_WEI = ethers.parseEther('0.001');

const MAX_REQUESTS_PER_IP = 3;
const RATE_LIMIT_WINDOW_MINUTES = 10;

// Tope AGREGADO por IP en 24h, además del de 10 minutos de arriba —
// pensado para un patrón distinto de abuso (no detectado hasta que pasó
// de verdad en pruebas): desinstalar y reinstalar la app genera una
// wallet NUEVA cada vez (SecureStore se borra con la desinstalación), y
// cada wallet nueva puede pedir su propia recarga — el límite de 10
// minutos no frena eso si las reinstalaciones están espaciadas. 20
// pedidos/día × 0.05 POL = 1 POL máximo posible por IP en un día,
// generoso para pruebas reales pero ya no ilimitado.
const MAX_REQUESTS_PER_IP_PER_DAY = 20;
const DAILY_LIMIT_WINDOW_HOURS = 24;

// Tope de recargas totales por dirección, de por vida — antes era 1
// (para siempre), lo que bloqueaba a alguien que de verdad gastó su gas
// sellando en lote. 5 recargas × 0.05 POL = 0.25 POL máximo posible por
// dirección, acotado y razonable para testnet.
const MAX_FUNDINGS_PER_ADDRESS = 5;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

interface FundPayload {
  address?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405);
  }

  let payload: FundPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400);
  }

  const address = payload.address;
  if (!address || !ethers.isAddress(address)) {
    return jsonResponse({ error: 'Dirección inválida.' }, 400);
  }
  const normalizedAddress = ethers.getAddress(address);

  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1) ¿Ya se agotó el tope de recargas de esta dirección? Antes esto
  // era "¿ya se fondeó alguna vez?" (una sola vez para siempre) — ahora
  // es un CONTEO, para permitir varias recargas legítimas sin abrir la
  // puerta a un abuso ilimitado.
  const { count: fundingCount, error: fundedLookupError } = await supabase
    .from('funded_wallets')
    .select('id', { count: 'exact', head: true })
    .eq('address', normalizedAddress);

  if (fundedLookupError) {
    console.error('Error consultando funded_wallets:', fundedLookupError);
    return jsonResponse({ error: 'Error interno.' }, 500);
  }
  if ((fundingCount ?? 0) >= MAX_FUNDINGS_PER_ADDRESS) {
    return jsonResponse({ ok: true, funded: false, reason: 'max_fundings_reached' });
  }

  // 2) Límite por IP — evita pedidos en cadena desde el mismo origen.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count: recentRequestCount, error: rateLimitError } = await supabase
    .from('fund_requests_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip', clientIp)
    .gte('requested_at', windowStart);

  if (rateLimitError) {
    console.error('Error consultando fund_requests_log:', rateLimitError);
    return jsonResponse({ error: 'Error interno.' }, 500);
  }
  if ((recentRequestCount ?? 0) >= MAX_REQUESTS_PER_IP) {
    return jsonResponse({ error: 'Demasiados pedidos, intenta más tarde.' }, 429);
  }

  // 2.5) Tope diario por IP — ver comentario en MAX_REQUESTS_PER_IP_PER_DAY
  // más arriba. Cubre el caso de reinstalaciones espaciadas (cada una con
  // wallet nueva) que el límite de 10 minutos no alcanza a frenar.
  const dayWindowStart = new Date(Date.now() - DAILY_LIMIT_WINDOW_HOURS * 60 * 60_000).toISOString();
  const { count: dailyRequestCount, error: dailyLimitError } = await supabase
    .from('fund_requests_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip', clientIp)
    .gte('requested_at', dayWindowStart);

  if (dailyLimitError) {
    console.error('Error consultando el tope diario en fund_requests_log:', dailyLimitError);
    return jsonResponse({ error: 'Error interno.' }, 500);
  }
  if ((dailyRequestCount ?? 0) >= MAX_REQUESTS_PER_IP_PER_DAY) {
    return jsonResponse({ error: 'Se alcanzó el máximo de recargas por hoy desde este origen. Intenta mañana.' }, 429);
  }

  // Se registra el intento ANTES de mandar la transacción, para que el
  // límite cuente incluso si algo falla después.
  await supabase.from('fund_requests_log').insert({ ip: clientIp, address: normalizedAddress });

  const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);

  // 3) Si la wallet ya tiene saldo (p. ej. reinstalación con la misma
  // keystore), no se le manda nada.
  let currentBalance: bigint;
  try {
    currentBalance = await provider.getBalance(normalizedAddress);
  } catch (error) {
    console.error('Error consultando balance en Amoy:', error);
    return jsonResponse({ error: 'No se pudo consultar la blockchain. Intenta de nuevo.' }, 502);
  }
  if (currentBalance >= MIN_BALANCE_THRESHOLD_WEI) {
    return jsonResponse({ ok: true, funded: false, reason: 'already_has_balance' });
  }

  // 4) Leer la clave privada del funder desde Vault (nunca del cliente).
  // El esquema "vault" no está expuesto por PostgREST, así que se lee a
  // través de la función RPC get_decrypted_secret (SECURITY DEFINER,
  // solo ejecutable por la service role — ver migración correspondiente).
  const { data: funderPrivateKey, error: secretError } = await supabase.rpc('get_decrypted_secret', {
    secret_name: 'verity_funder_private_key',
  });

  if (secretError || !funderPrivateKey) {
    console.error('Error leyendo la clave del funder desde Vault:', secretError);
    return jsonResponse({ error: 'Error interno.' }, 500);
  }

  const funderWallet = new ethers.Wallet(funderPrivateKey, provider);

  // 5) Enviar la gotita de POL.
  let txHash: string;
  try {
    const tx = await funderWallet.sendTransaction({
      to: normalizedAddress,
      value: FUNDING_AMOUNT_WEI,
    });
    txHash = tx.hash;
  } catch (error) {
    console.error('Error mandando la transacción de financiamiento:', error);
    return jsonResponse({ error: 'No se pudo enviar el financiamiento. Intenta de nuevo.' }, 502);
  }

  // 6) Registrar el fondeo — cuenta contra el tope MAX_FUNDINGS_PER_ADDRESS
  // de esta dirección (ver paso 1).
  const { error: insertError } = await supabase.from('funded_wallets').insert({
    address: normalizedAddress,
    tx_hash: txHash,
    amount_wei: FUNDING_AMOUNT_WEI.toString(),
  });
  if (insertError) {
    // La transacción ya salió — esto solo afecta el registro/protección
    // contra reenvíos futuros, se reporta pero no se revierte nada.
    console.error('Error guardando en funded_wallets (la tx ya se envió):', insertError);
  }

  return jsonResponse({ ok: true, funded: true, txHash });
});
