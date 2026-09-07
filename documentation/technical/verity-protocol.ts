/**
 * verity-protocol.ts
 * ---------------------------------------------------------------------------
 * Definición técnica SIMPLIFICADA del protocolo Verity para el MVP de
 * Shipaton 2026. Esto es documentación viva (no se ejecuta en la app),
 * pensada para que cualquier colaborador entienda las piezas del sistema
 * sin tener que leer el documento maestro completo (ver
 * reference/VERITY_VRT_Documento_Maestro_v1.1.pdf, que es solo referencia
 * conceptual, NO se implementa tal cual para este MVP).
 *
 * Alcance de este MVP (lo que SÍ existe):
 * - Hash SHA-256 local del archivo (hashService.ts)
 * - Anclaje del hash en Polygon Amoy testnet (blockchainService.ts)
 * - 3 niveles de confianza simplificados (ver TrustLevel)
 * - Freemium con RevenueCat (revenuecatService.ts)
 *
 * Fuera de alcance para este MVP (explícitamente NO implementado):
 * - Detección de contenido generado por IA
 * - Wallet visible / multi-chain / token VRT
 * - Login de usuario
 */

/**
 * Nivel de confianza de un sello, calculado en el dispositivo según cómo
 * se obtuvo el archivo. Simplificado a 3 niveles para el MVP (el protocolo
 * completo define una escala más granular, no usada aquí).
 */
export type TrustLevel = 'ALTO' | 'MEDIO' | 'BAJO';

/**
 * Reglas para asignar el nivel de confianza (lógica vive en el flujo de
 * captura, esto documenta el criterio):
 * - ALTO:  la foto/video se capturó con la cámara de la propia app,
 *          y se pudo leer GPS + hora + info del dispositivo al momento
 *          de la captura.
 * - MEDIO: el archivo viene de la galería y tiene metadatos EXIF
 *          (cámara, fecha) pero no fue capturado dentro de la app, por lo
 *          que esos metadatos no se pueden verificar de forma tan estricta.
 *          Los videos de galería también caen aquí aunque no traigan EXIF:
 *          `DateTimeOriginal` es un tag exclusivo de fotos, así que no
 *          existe una fecha de captura verificable para videos que la
 *          plataforma pueda entregar — exigirla los dejaría siempre en
 *          BAJO sin importar el archivo.
 * - BAJO:  el archivo no trae metadatos utilizables (o fueron removidos,
 *          por ejemplo al pasar por WhatsApp u otra app de mensajería).
 */
export const TRUST_LEVEL_CRITERIA: Record<TrustLevel, string> = {
  ALTO: 'Capturado con la cámara de la app (GPS + hora + dispositivo verificados).',
  MEDIO: 'Archivo de galería con metadatos EXIF presentes (o un video de galería).',
  BAJO: 'Archivo sin metadatos verificables.',
};

/** Metadatos opcionales capturados junto con el archivo (según disponibilidad). */
export interface CaptureMetadata {
  latitude?: number;
  longitude?: number;
  capturedAt?: string; // ISO 8601
  deviceModel?: string;
  source: 'camera' | 'gallery';
  /**
   * Verity sella tanto fotos como videos. Se usa para decidir cómo
   * mostrar la miniatura (un video no se puede renderizar con <Image>).
   * Ausente = imagen, por compatibilidad con certificados creados antes
   * de agregar este campo.
   */
  mediaType?: 'image' | 'video';
}

/**
 * Un "Certificado" es el resultado final que ve el usuario: la combinación
 * del hash local + el registro en blockchain + el nivel de confianza.
 * Es lo que se guarda en el historial local (CertificatesScreen.tsx) y lo
 * que se muestra en CertificateCard.tsx.
 */
export interface VerityCertificate {
  /** Identificador local (uuid), no depende de ningún servidor. */
  id: string;
  /** Hash SHA-256 del archivo original (ver hashService.ts). */
  sha256: string;
  /** Nivel de confianza calculado al momento de sellar. */
  trustLevel: TrustLevel;
  /** Metadatos de captura disponibles (pueden ser parciales o ausentes). */
  metadata: CaptureMetadata;
  /** Resultado del anclaje en blockchain (ver blockchainService.ts). */
  anchor: {
    txHash: string;
    walletAddress: string;
    anchoredAt: string;
    explorerUrl: string;
  };
  /** Miniatura local del archivo, solo para mostrar en el historial (no se sube). */
  thumbnailUri?: string;
  /**
   * Solo para videos: un frame extraído del video (imagen fija), generado
   * en el dispositivo al sellar, para poder mostrar una vista previa real
   * en vez de un ícono genérico de cámara. `thumbnailUri` sigue siendo el
   * video en sí (necesario para compartirlo/reproducirlo); este campo es
   * la imagen usada solo para mostrar la miniatura.
   */
  previewImageUri?: string;
}

/**
 * Formato del archivo de copia de seguridad exportable del historial local
 * (ver cryptoUtils.ts: buildBackup/importBackup). Deliberadamente NO
 * incluye la foto ni su miniatura — solo hashes, números de sello y
 * metadatos — así que por sí solo no prueba autoría de una imagen, solo
 * restaura el índice local de "qué se selló y cuándo".
 */
export interface CertificatesBackup {
  version: 1;
  exportedAt: string;
  certificates: Omit<VerityCertificate, 'thumbnailUri' | 'previewImageUri'>[];
}

/**
 * Límites del modelo freemium para Shipaton (ver revenuecatService.ts).
 * PRO no cambia el protocolo, solo levanta el límite mensual de sellos.
 */
export const FREEMIUM_LIMITS = {
  FREE_SEALS_PER_MONTH: 10,
  PRO_MONTHLY_PRICE_USD: 4.99,
  PRO_ENTITLEMENT_ID: 'pro',
} as const;
