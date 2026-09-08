/**
 * cryptoUtils.ts
 * ---------------------------------------------------------------------------
 * Utilidades pequeñas compartidas por servicios y pantallas. Para el MVP,
 * esto también hace de "base de datos" del historial local de sellos:
 * se guarda en AsyncStorage (almacenamiento local del teléfono), NO en
 * ningún servidor — coherente con "la app funciona sin cuenta".
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  VerityCertificate,
  CertificatesBackup,
} from '../../documentation/technical/verity-protocol';

const CERTIFICATES_STORAGE_KEY = 'verity_certificates_history';
const SEQUENCE_STORAGE_KEY = 'verity_next_sequence_number';

/**
 * Devuelve el próximo número de secuencia de este teléfono (1, 2, 3...)
 * y avanza el contador — una sola secuencia para fotos y videos, cámara
 * o galería, en el orden en que se sellaron. Es un número real y útil
 * (sirve para nombrar/ordenar tus propios archivos), no uno inventado
 * solo para verse bien. Ver VerityCertificate.sequenceNumber.
 */
export async function getNextSequenceNumber(): Promise<number> {
  const raw = await AsyncStorage.getItem(SEQUENCE_STORAGE_KEY);
  const next = raw ? parseInt(raw, 10) + 1 : 1;
  await AsyncStorage.setItem(SEQUENCE_STORAGE_KEY, String(next));
  return next;
}

/** Guarda un certificado nuevo al principio del historial local. */
export async function saveCertificate(certificate: VerityCertificate): Promise<void> {
  const existing = await getCertificates();
  const updated = [certificate, ...existing];
  await AsyncStorage.setItem(CERTIFICATES_STORAGE_KEY, JSON.stringify(updated));
}

/** Lee todo el historial local de sellos, más reciente primero. */
export async function getCertificates(): Promise<VerityCertificate[]> {
  const raw = await AsyncStorage.getItem(CERTIFICATES_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as VerityCertificate[];
  } catch {
    return [];
  }
}

/** Cuenta cuántos sellos se hicieron en el mes en curso (para el límite freemium). */
export async function countSealsThisMonth(): Promise<number> {
  const all = await getCertificates();
  const now = new Date();
  return all.filter((c) => {
    // Un certificado importado de una copia de seguridad (ver
    // importBackup, abajo) se selló de verdad en OTRO teléfono, tal vez
    // hace meses — no debe contar contra el cupo gratis de ESTE mes en
    // ESTE dispositivo, aunque su fecha de anclaje original caiga
    // dentro del mes actual. Bug real encontrado en pruebas: sin este
    // filtro, restaurar un respaldo con sellos viejos inflaba el
    // contador de uso (ej. "14/30" habiendo sellado solo 3 acá).
    if (c.importedAt) return false;
    const date = new Date(c.anchor.anchoredAt);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
}

/**
 * Busca en el historial local si un hash ya fue sellado antes. Se usa para
 * evitar sellar (y pagar gas) dos veces el mismo archivo por accidente, y
 * para poder avisarle al usuario "ya sellaste esto" en vez de dejarlo con
 * dos certificados sin saber cuál es cuál.
 */
export async function findCertificateByHash(
  sha256: string
): Promise<VerityCertificate | null> {
  const all = await getCertificates();
  return all.find((c) => c.sha256 === sha256) ?? null;
}

/**
 * Busca en el historial local un certificado por su NÚMERO DE SELLO (hash
 * de transacción), no por el hash del archivo. Se usa en "Verificar" para
 * la búsqueda manual: si el sello que el usuario escribió corresponde a
 * algo sellado en este mismo dispositivo, se puede mostrar el certificado
 * completo (con foto) en vez de solo confirmar que existe en la blockchain.
 */
export async function findCertificateByTxHash(
  txHash: string
): Promise<VerityCertificate | null> {
  const all = await getCertificates();
  const normalized = txHash.trim().toLowerCase();
  return all.find((c) => c.anchor.txHash.toLowerCase() === normalized) ?? null;
}

/**
 * Arma el objeto de respaldo a partir del historial local actual (ver
 * CertificatesBackup en verity-protocol.ts para el porqué de su formato
 * deliberadamente mínimo: nunca incluye la foto, solo hashes y metadatos).
 */
export async function buildBackup(): Promise<CertificatesBackup> {
  const all = await getCertificates();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    // Se omiten thumbnailUri y previewImageUri a propósito: son rutas
    // locales del dispositivo (no una foto en sí) que de todos modos no
    // existirán en otro teléfono, y así queda explícito que el respaldo
    // no contiene ninguna imagen ni frame de video.
    certificates: all.map(({ thumbnailUri, previewImageUri, ...rest }) => rest),
  };
}

/**
 * Combina un respaldo importado con el historial local actual, sin
 * duplicar certificados que ya existan (comparando por id y por hash).
 * Devuelve cuántos certificados nuevos se agregaron.
 */
export async function importBackup(backup: CertificatesBackup): Promise<number> {
  const existing = await getCertificates();
  const existingIds = new Set(existing.map((c) => c.id));
  const existingHashes = new Set(existing.map((c) => c.sha256));

  const newOnes = backup.certificates
    .filter((c) => !existingIds.has(c.id) && !existingHashes.has(c.sha256))
    // Se marca como importado AHORA (no se conserva un importedAt viejo
    // si el propio backup ya traía uno de una restauración anterior) —
    // ver el campo importedAt en verity-protocol.ts para el porqué.
    .map((c) => ({ ...c, importedAt: new Date().toISOString() }));

  if (newOnes.length === 0) return 0;

  const merged = [...newOnes, ...existing];
  await AsyncStorage.setItem(CERTIFICATES_STORAGE_KEY, JSON.stringify(merged));
  return newOnes.length;
}
