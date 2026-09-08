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
import { File } from 'expo-file-system';

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
 * Límite de tamaño para hashear un archivo. Este método lee el archivo
 * COMPLETO en memoria (ver nota abajo) — funciona bien para fotos (unos
 * pocos MB) y videos cortos, pero un video largo/pesado podría agotar la
 * memoria de la app y hacerla fallar en vez de mostrar un error claro.
 * 80MB es un límite conservador para el MVP; una versión futura debería
 * hashear por streaming/chunks para no tener este techo.
 */
const MAX_HASHABLE_BYTES = 80 * 1024 * 1024;

/**
 * Calcula el SHA-256 de un archivo local a partir de su URI (la que entrega
 * expo-image-picker o expo-camera, ej: "file:///.../photo.jpg").
 *
 * CORREGIDO — bug real encontrado en pruebas: la versión anterior leía el
 * archivo como texto base64 y le calculaba el hash a ESE TEXTO
 * (`Crypto.digestStringAsync` opera sobre strings, no sobre bytes) en vez
 * de calcular el hash de los BYTES reales del archivo. El resultado era
 * un valor interno consistente para Verity (por eso "duplicados" y "por
 * número de sello" seguían funcionando), pero que NO correspondía al
 * SHA-256 real y estándar del archivo — así que ninguna herramienta
 * externa (incluida la página pública de verificación, que sí calcula el
 * SHA-256 real con la Web Crypto API del navegador) podía reconocerlo,
 * sin importar qué copia del archivo se usara. Ahora se leen los bytes
 * crudos (`file.arrayBuffer()`) y se hashean con `Crypto.digest()` — la
 * versión de expo-crypto que opera sobre bytes, equivalente a
 * `crypto.subtle.digest()` en el navegador — dando el mismo resultado que
 * cualquier herramienta estándar (`sha256sum`, la página web, etc.)
 * calcularía sobre el mismo archivo.
 *
 * Nota: usa la API de expo-file-system@57 (clase `File`), que reemplazó a
 * las funciones sueltas `getInfoAsync`/`readAsStringAsync` de versiones
 * anteriores del SDK.
 *
 * @param fileUri URI local del archivo (nunca una URL remota).
 */
export async function hashFile(fileUri: string): Promise<HashResult> {
  const file = new File(fileUri);

  if (!file.exists) {
    throw new Error('El archivo no existe en el dispositivo.');
  }

  if ((file.size ?? 0) > MAX_HASHABLE_BYTES) {
    throw new Error(
      'Este archivo es demasiado pesado para sellarlo en esta versión de Verity (el límite actual es 80MB). Prueba con un video más corto.'
    );
  }

  // Bytes crudos del archivo, en memoria local — nunca se envían a
  // ningún servidor.
  const buffer = await file.arrayBuffer();
  const digestBuffer = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, buffer);
  const sha256 = bufferToHex(digestBuffer);

  return {
    sha256,
    fileSizeBytes: file.size ?? 0,
    hashedAt: new Date().toISOString(),
  };
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
