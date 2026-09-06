/**
 * hashService.ts
 * ---------------------------------------------------------------------------
 * Genera la "huella digital" (hash SHA-256) de una foto/video DIRECTAMENTE
 * en el dispositivo. El archivo original NUNCA sale del teléfono ni se sube
 * a ningún servidor: solo el hash (un texto de 64 caracteres) viaja hacia
 * afuera, hacia el registro en blockchain (ver blockchainService.ts).
 *
 * Por qué esto importa para Verity:
 * - El hash es como una "huella dactilar" del archivo: si un solo pixel
 *   cambia, el hash cambia por completo. Eso permite probar más adelante
 *   que un archivo "es el mismo" que se selló, sin tener que guardar ni
 *   compartir el archivo en sí.
 * - Usamos expo-crypto porque ya viene con Expo (no requiere código nativo
 *   adicional) y soporta SHA-256 de forma nativa en iOS/Android.
 */

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

/** Resultado de hashear un archivo, listo para mostrar o anclar en blockchain. */
export interface HashResult {
  /** Hash SHA-256 en hexadecimal (64 caracteres), ej: "a3f5...c9" */
  sha256: string;
  /** Tamaño del archivo en bytes, útil para mostrar info al usuario. */
  fileSizeBytes: number;
  /** Momento exacto (ISO 8601) en que se calculó el hash en el dispositivo. */
  hashedAt: string;
}

/**
 * Calcula el SHA-256 de un archivo local a partir de su URI (la que entrega
 * expo-image-picker o expo-camera, ej: "file:///.../photo.jpg").
 *
 * IMPORTANTE: expo-crypto no puede hashear un archivo grande directamente
 * desde disco por streaming, así que lo leemos como base64 en memoria y
 * lo hasheamos. Para fotos de celular (unos pocos MB) esto es rápido y
 * suficiente para el MVP. Si en el futuro se soportan videos largos, esto
 * debería migrarse a un hash por streaming/chunks.
 *
 * @param fileUri URI local del archivo (nunca una URL remota).
 */
export async function hashFile(fileUri: string): Promise<HashResult> {
  const fileInfo = await FileSystem.getInfoAsync(fileUri, { size: true });

  if (!fileInfo.exists) {
    throw new Error('El archivo no existe en el dispositivo.');
  }

  // Leemos el contenido como base64. Esto SOLO ocurre en memoria local,
  // nunca se envía a ningún servidor.
  const base64Content = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const sha256 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64Content,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return {
    sha256,
    fileSizeBytes: fileInfo.size ?? 0,
    hashedAt: new Date().toISOString(),
  };
}

/**
 * Utilidad simple para hashear un string arbitrario (ej: metadatos
 * combinados con el hash del archivo, para armar el "paquete de sello").
 * No se usa para archivos grandes, solo para strings cortos como JSON.
 */
export async function hashString(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}
