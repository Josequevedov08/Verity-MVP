/**
 * verificationIndexService.ts
 * ---------------------------------------------------------------------------
 * Índice público mínimo de certificados (Supabase, proyecto "verity-mvp" —
 * ver backend/README.md). Resuelve un límite real del MVP: sin esto, un
 * certificado sellado en OTRO dispositivo solo se puede confirmar si quien
 * lo selló te pasa a mano su número de sello (el hash de la transacción).
 * Con este índice, "Verificar" puede encontrarlo directo por la huella
 * digital del archivo, sin importar en qué teléfono se selló.
 *
 * Solo guarda metadatos que YA son públicos en la blockchain una vez
 * anclados (hash, tx, wallet, nivel de confianza, tipo de medio, fecha) —
 * NUNCA el archivo original ni una miniatura. La escritura pasa por la
 * Edge Function `submit-certificate`, que verifica el anclaje real en
 * Polygon Amoy antes de aceptar cualquier dato (ver su código fuente en
 * backend/supabase/functions/submit-certificate/index.ts) — así nadie
 * puede rellenar el índice con datos inventados.
 */
import type { TrustLevel, VerityCertificate } from '../../documentation/technical/verity-protocol';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface PublicIndexEntry {
  sha256: string;
  txHash: string;
  walletAddress: string;
  sequenceNumber: string | null;
  trustLevel: TrustLevel;
  mediaType: 'image' | 'video';
  sealedAt: string;
  explorerUrl: string;
}

/**
 * Envía los metadatos públicos de un certificado recién sellado al índice.
 * Deliberadamente "fire and forget": nunca debe bloquear ni romper el
 * sellado si falla (sin internet hacia Supabase, índice caído, etc.) — el
 * certificado ya quedó anclado en Polygon de todas formas, que es lo que
 * de verdad importa. Esto es solo una comodidad de búsqueda encima.
 */
export async function submitToPublicIndex(certificate: VerityCertificate): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  try {
    await fetch(`${SUPABASE_URL}/functions/v1/submit-certificate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sha256: certificate.sha256,
        txHash: certificate.anchor.txHash,
        walletAddress: certificate.anchor.walletAddress,
        // Formateado igual que en pantalla (ver formatSequenceRef en
        // CertificateDetailModal.tsx) — el campo es un `number` interno,
        // pero lo que el índice público guarda es la referencia visible
        // ("#A00001"), no el número crudo.
        sequenceNumber:
          certificate.sequenceNumber != null
            ? `#A${String(certificate.sequenceNumber).padStart(5, '0')}`
            : null,
        trustLevel: certificate.trustLevel,
        mediaType: certificate.metadata.mediaType ?? 'image',
        sealedAt: certificate.anchor.anchoredAt,
      }),
    });
  } catch (error) {
    console.warn('No se pudo registrar el certificado en el índice público (no es crítico):', error);
  }
}

/**
 * Busca un hash en el índice público — se usa en "Verificar" cuando el
 * archivo no aparece en el historial local de ESTE dispositivo, para
 * confirmar si fue sellado desde otro. Solo lectura (RLS permite SELECT a
 * cualquiera; la clave usada aquí es la "anon"/publicable, pensada para
 * exponerse en un cliente — nunca una service key).
 */
export async function lookupInPublicIndex(sha256: string): Promise<PublicIndexEntry | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const clean = sha256.startsWith('0x') ? sha256.toLowerCase() : `0x${sha256.toLowerCase()}`;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/certificates?sha256=eq.${encodeURIComponent(clean)}&select=*`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) return null;

    const rows = (await res.json()) as Array<{
      sha256: string;
      tx_hash: string;
      wallet_address: string;
      sequence_number: string | null;
      trust_level: TrustLevel;
      media_type: 'image' | 'video';
      sealed_at: string;
    }>;
    const row = rows[0];
    if (!row) return null;

    return {
      sha256: row.sha256,
      txHash: row.tx_hash,
      walletAddress: row.wallet_address,
      sequenceNumber: row.sequence_number,
      trustLevel: row.trust_level,
      mediaType: row.media_type,
      sealedAt: row.sealed_at,
      explorerUrl: `https://amoy.polygonscan.com/tx/${row.tx_hash}`,
    };
  } catch (error) {
    console.warn('No se pudo consultar el índice público:', error);
    return null;
  }
}
