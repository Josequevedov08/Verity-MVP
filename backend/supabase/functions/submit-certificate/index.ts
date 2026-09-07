// submit-certificate
// ---------------------------------------------------------------------------
// Recibe los metadatos públicos de UN certificado recién sellado (nunca el
// archivo) y los guarda en el índice público SOLO si puede confirmar, leyendo
// directo de Polygon Amoy, que el anclaje es real: una transacción de valor 0
// de esa wallet hacia sí misma, cuyo `data` es exactamente ese hash SHA-256.
// Sin esta verificación, cualquiera podría rellenar el índice con hashes o
// niveles de confianza inventados.
//
// verify_jwt=false a propósito: Verity no tiene login/sesión, así que no hay
// un JWT de usuario que exigir — la verificación real es la de la cadena.
// Mitigación de "alguien reenvía un anclaje real ajeno con metadatos falsos":
// sha256 es la llave primaria y el insert es "ON CONFLICT DO NOTHING" — la
// PRIMERA vez que se registra un hash gana, cualquier reenvío posterior con
// datos distintos para el MISMO hash se ignora silenciosamente.
//
// Desplegado en el proyecto Supabase "verity-mvp" vía MCP — este archivo es
// la copia versionada en el repo para referencia/reproducibilidad; el que
// corre de verdad se administra desde el dashboard de Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const AMOY_RPC_URL = 'https://polygon-amoy-bor-rpc.publicnode.com';

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

interface SubmitPayload {
  sha256?: string;
  txHash?: string;
  walletAddress?: string;
  sequenceNumber?: string | null;
  trustLevel?: string;
  mediaType?: string;
  sealedAt?: string;
}

/** Llama al RPC público de Amoy con una petición JSON-RPC cruda — no hace
 * falta ethers.js para una sola lectura de transacción. */
async function getTransaction(txHash: string) {
  const res = await fetch(AMOY_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionByHash',
      params: [txHash],
    }),
  });
  const json = await res.json();
  return json.result as null | { to: string; from: string; input: string; value: string; hash: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405);
  }

  let payload: SubmitPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400);
  }

  const { sha256, txHash, walletAddress, sequenceNumber, trustLevel, mediaType, sealedAt } = payload;

  if (!sha256 || !txHash || !walletAddress || !trustLevel || !mediaType || !sealedAt) {
    return jsonResponse({ error: 'Faltan campos obligatorios.' }, 400);
  }
  if (!['ALTO', 'MEDIO', 'BAJO'].includes(trustLevel)) {
    return jsonResponse({ error: 'trustLevel inválido.' }, 400);
  }
  if (!['image', 'video'].includes(mediaType)) {
    return jsonResponse({ error: 'mediaType inválido.' }, 400);
  }

  const cleanHash = sha256.startsWith('0x') ? sha256.toLowerCase() : `0x${sha256.toLowerCase()}`;

  let tx;
  try {
    tx = await getTransaction(txHash);
  } catch (error) {
    console.error('Error consultando Polygon Amoy:', error);
    return jsonResponse({ error: 'No se pudo consultar la blockchain. Intenta de nuevo.' }, 502);
  }

  if (!tx) {
    return jsonResponse({ error: 'Esa transacción no existe (todavía) en Polygon Amoy.' }, 404);
  }

  const sameWallet =
    tx.to?.toLowerCase() === walletAddress.toLowerCase() &&
    tx.from?.toLowerCase() === walletAddress.toLowerCase();
  const zeroValue = tx.value === '0x0' || tx.value === '0x' || BigInt(tx.value ?? '0x0') === 0n;
  const hashMatches = tx.input?.toLowerCase() === cleanHash;

  if (!sameWallet || !zeroValue || !hashMatches) {
    return jsonResponse(
      { error: 'La transacción no tiene la forma de un anclaje válido de Verity para ese hash.' },
      422
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { error } = await supabase
    .from('certificates')
    .upsert(
      {
        sha256: cleanHash,
        tx_hash: txHash,
        wallet_address: walletAddress,
        sequence_number: sequenceNumber ?? null,
        trust_level: trustLevel,
        media_type: mediaType,
        sealed_at: sealedAt,
      },
      { onConflict: 'sha256', ignoreDuplicates: true }
    );

  if (error) {
    console.error('Error guardando en el índice público:', error);
    return jsonResponse({ error: 'No se pudo guardar en el índice público.' }, 500);
  }

  return jsonResponse({ ok: true });
});
