/**
 * cryptoUtils.ts
 * ---------------------------------------------------------------------------
 * Utilidades pequeñas compartidas por servicios y pantallas. Para el MVP,
 * esto también hace de "base de datos" del historial local de sellos:
 * se guarda en AsyncStorage (almacenamiento local del teléfono), NO en
 * ningún servidor — coherente con "la app funciona sin cuenta".
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

const CERTIFICATES_STORAGE_KEY = 'verity_certificates_history';

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
    const date = new Date(c.anchor.anchoredAt);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
}
