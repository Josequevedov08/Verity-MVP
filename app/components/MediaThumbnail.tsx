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
 * - Cualquier otro caso (video sin vista previa, o sin archivo local en
 *   absoluto — ej. un certificado restaurado desde una copia de
 *   seguridad, que nunca incluye la foto/video): SealMedallion, el
 *   sello circular de verificación coloreado según el nivel de
 *   confianza (NO una imagen del contenido — a propósito, para no
 *   confundir "esto certifica el hash" con "esto es la foto real").
 *
 * Se usa en CertificateCard, CertificatesScreen (grilla) y
 * CertificateDetailModal — antes cada uno repetía esta lógica.
 */
import React from 'react';
import { View, Image, StyleSheet, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import SealMedallion from './SealMedallion';
import { useTheme } from '../theme/ThemeContext';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

export default function MediaThumbnail({
  uri,
  mediaType,
  previewUri,
  trustLevel,
  style,
  iconSize = 22,
}: {
  uri?: string;
  mediaType?: 'image' | 'video';
  /** Frame real extraído del video, si se generó al sellar (solo aplica
   * cuando mediaType === 'video'). */
  previewUri?: string;
  /** Solo se usa para colorear SealMedallion cuando no hay nada más que
   * mostrar. */
  trustLevel?: VerityCertificate['trustLevel'];
  /** Acepta el mismo objeto de estilo (width/height/border...) para
   * dimensionar tanto la <Image> como los placeholders de <View>. */
  style?: StyleProp<ImageStyle>;
  iconSize?: number;
}) {
  const { colors } = useTheme();
  // Los placeholders son <View>, que no acepta todas las propiedades de
  // ImageStyle (ej. `resizeMode`) -- en la práctica solo se les pasan
  // estilos de layout (width/height/border...), válidos en ambos.
  const viewStyle = style as StyleProp<ViewStyle>;

  if (uri && mediaType !== 'video') {
    return <Image source={{ uri }} style={style} />;
  }

  if (uri && mediaType === 'video' && previewUri) {
    return (
      <View style={viewStyle}>
        <Image source={{ uri: previewUri }} style={style} />
        <View style={[styles.videoBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]} pointerEvents="none">
          <Ionicons name="videocam" size={Math.max(10, Math.round(iconSize * 0.5))} color="#fff" />
        </View>
      </View>
    );
  }

  return (
    <View style={[viewStyle, styles.medallionSlot, { backgroundColor: colors.surfaceAlt }]}>
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
