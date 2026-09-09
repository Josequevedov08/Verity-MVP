/**
 * MediaThumbnail.tsx
 * ---------------------------------------------------------------------------
 * Miniatura de un certificado, con estados posibles:
 * - Foto disponible: se muestra con <Image>.
 * - Video disponible CON vista previa generada (previewUri — un frame
 *   real extraído del video al sellar, ver CaptureScreen.generateVideoPreview):
 *   se muestra ese frame como <Image>, con una insignia chica de cámara
 *   en la esquina superior izquierda para distinguirlo de una foto (una
 *   <Image> no puede decodificar video, así que sin el frame real solo
 *   se podía mostrar un ícono genérico).
 * - Sin archivo local (certificado restaurado de una copia de seguridad)
 *   PERO con backupThumbnail (ver VerityCertificate.backupThumbnailBase64):
 *   se muestra esa miniatura diminuta, con una insignia de "restaurado"
 *   en la esquina — así se distingue de una foto real de alta calidad,
 *   sin dejar el certificado completamente irreconocible. Ver el porqué
 *   de este campo en verity-protocol.ts.
 * - Cualquier otro caso (video sin vista previa, o sin archivo local NI
 *   miniatura de respaldo): SealMedallion, el sello circular de
 *   verificación coloreado según el nivel de confianza (NO una imagen
 *   del contenido — a propósito, para no confundir "esto certifica el
 *   hash" con "esto es la foto real").
 *
 * Se usa en CertificateCard, CertificatesScreen (grilla) y
 * CertificateDetailModal — antes cada uno repetía esta lógica.
 */
import React from 'react';
import { View, Image, StyleSheet, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import SealMedallion from './SealMedallion';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

export default function MediaThumbnail({
  uri,
  mediaType,
  previewUri,
  backupThumbnail,
  trustLevel,
  style,
  iconSize = 22,
}: {
  uri?: string;
  mediaType?: 'image' | 'video';
  /** Frame real extraído del video, si se generó al sellar (solo aplica
   * cuando mediaType === 'video'). */
  previewUri?: string;
  /** Miniatura diminuta y comprimida de un certificado restaurado desde
   * una copia de seguridad (ver VerityCertificate.backupThumbnailBase64)
   * — solo se usa cuando no hay `uri` (no hay archivo local real). */
  backupThumbnail?: string;
  /** Solo se usa para colorear SealMedallion cuando no hay nada más que
   * mostrar. */
  trustLevel?: VerityCertificate['trustLevel'];
  /** Acepta el mismo objeto de estilo (width/height/border...) para
   * dimensionar tanto la <Image> como los placeholders de <View>. */
  style?: StyleProp<ImageStyle>;
  iconSize?: number;
}) {
  // Los placeholders son <View>, que no acepta todas las propiedades de
  // ImageStyle (ej. `resizeMode`) -- en la práctica solo se les pasan
  // estilos de layout (width/height/border...), válidos en ambos.
  const viewStyle = style as StyleProp<ViewStyle>;

  if (uri && mediaType !== 'video') {
    return <Image source={{ uri }} style={style} />;
  }

  if (uri && mediaType === 'video' && previewUri) {
    // La <Image> usa position:'absolute' + inset 0 a propósito (no
    // `style` directo): desde que CertificateCard dejó de fijar un alto
    // explícito en la miniatura (para poder estirarse al alto real de
    // la fila — ver CertificateCard.tsx), una <Image> SIN alto propio
    // anidada dentro de una <View> que TAMPOCO tiene alto propio crea
    // una dependencia circular (cada una espera el tamaño de la otra)
    // que Yoga resuelve en 0px — el frame del video dejaba de verse
    // por completo. Con position:'absolute', el tamaño de la Image ya
    // no participa en el cálculo del contenedor: el contenedor toma su
    // alto de afuera (stretch de la fila) y la imagen simplemente lo
    // rellena, sin depender de sí misma.
    return (
      <View style={viewStyle}>
        <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} />
        <View style={[styles.videoBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]} pointerEvents="none">
          <Ionicons name="videocam" size={Math.max(10, Math.round(iconSize * 0.5))} color="#fff" />
        </View>
      </View>
    );
  }

  if (backupThumbnail) {
    return (
      <View style={viewStyle}>
        <Image source={{ uri: backupThumbnail }} style={StyleSheet.absoluteFill} />
        {/* Insignia de "restaurado" — deja claro que esto NO es la foto
            real en su calidad original, solo una referencia visual chica
            para reconocerla (ver backupThumbnailBase64 en
            verity-protocol.ts). */}
        <View style={[styles.videoBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]} pointerEvents="none">
          <Ionicons name="time-outline" size={Math.max(10, Math.round(iconSize * 0.5))} color="#fff" />
        </View>
      </View>
    );
  }

  return (
    // Sin backgroundColor a propósito: un fondo gris atrás del sello se
    // veía como una caja vacía sobre la tarjeta (feedback real de
    // pruebas) — transparente deja ver solo el sello sobre el fondo de
    // la propia tarjeta, más limpio.
    <View style={[viewStyle, styles.medallionSlot]}>
      <SealMedallion trustLevel={trustLevel} size={Math.round(iconSize * 3.3)} />
      {mediaType === 'video' && (
        <View style={[styles.videoBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]} pointerEvents="none">
          <Ionicons name="videocam" size={Math.max(10, Math.round(iconSize * 0.5))} color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  medallionSlot: { alignItems: 'center', justifyContent: 'center' },
  videoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
