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
 * - Video disponible SIN vista previa (certificados sellados antes de
 *   tener esta función, o si la generación falló): ícono de cámara de
 *   video sobre fondo tintado.
 * - Sin archivo disponible (ej. certificado restaurado desde una copia
 *   de seguridad, que nunca incluye la foto/video): ícono neutro de
 *   "sin vista previa". Se probó usar el escudo grande de nivel de
 *   confianza aquí, a todo color — pero en la grilla, con varias
 *   miniaturas juntas, se leía como un HUD de videojuego y duplicaba la
 *   insignia de confianza que ya muestra CertificatesScreen en la
 *   esquina. El color de confianza vive SOLO en esa insignia chica;
 *   este placeholder se mantiene neutro.
 *
 * Se usa en CertificateCard, CertificatesScreen (grilla) y
 * CertificateDetailModal — antes cada uno repetía esta lógica.
 */
import React from 'react';
import { View, Image, StyleSheet, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';

export default function MediaThumbnail({
  uri,
  mediaType,
  previewUri,
  style,
  iconSize = 22,
}: {
  uri?: string;
  mediaType?: 'image' | 'video';
  /** Frame real extraído del video, si se generó al sellar (solo aplica
   * cuando mediaType === 'video'). */
  previewUri?: string;
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

  if (uri && mediaType === 'video') {
    return (
      <View style={[viewStyle, styles.placeholder, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="videocam" size={iconSize} color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[viewStyle, styles.placeholder, { backgroundColor: colors.surfaceAlt }]}>
      <Ionicons
        name={mediaType === 'video' ? 'videocam-outline' : 'image-outline'}
        size={Math.round(iconSize * 1.3)}
        color={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
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
