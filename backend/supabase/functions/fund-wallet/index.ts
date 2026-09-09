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
//   1. `funded_wallets`: cada dirección se fondea UNA SOLA VEZ para
//      siempre — un segundo pedido para la misma address se rechaza sin
//      tocar la blockchain.
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

// Antes 0.01 POL — se quedaba corto en pruebas reales con sellado en
// lote (varios anclajes seguidos agotaban el saldo a mitad de camino,
// con error real "insufficient funds for intrinsic transaction cost").
// 0.05 da margen real para un lote grande sin comprometer demasiado el
// fondo del proyecto (sigue siendo testnet, sin costo real).
const FUNDING_AMOUNT_WEI = ethers.parseEther('0.05');

// Si la wallet ya tiene al menos esto, no se le manda nada.
const MIN_BALANCE_THRESHOLD_WEI = ethers.parseEther('0.001');

const MAX_REQUESTS_PER_IP = 3;
const RATE_LIMIT_WINDOW_MINUTES = 10;

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

  // 1) ¿Ya se fondeó esta dirección alguna vez? Si sí, no se hace nada más.
  const { data: alreadyFunded, error: fundedLookupError } = await supabase
    .from('funded_wallets')
    .select('address')
    .eq('address', normalizedAddress)
    .maybeSingle();

  if (fundedLookupError) {
    console.error('Error consultando funded_wallets:', fundedLookupError);
    return jsonResponse({ error: 'Error interno.' }, 500);
  }
  if (alreadyFunded) {
    return jsonResponse({ ok: true, funded: false, reason: 'already_funded' });
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

  // 6) Registrar el fondeo — de aquí en adelante esta dirección nunca
  // vuelve a calificar, sin importar qué pase con su balance después.
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
