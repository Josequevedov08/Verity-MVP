/**
 * MediaThumbnail.tsx
 * ---------------------------------------------------------------------------
 * Miniatura de un certificado, con 3 estados posibles:
 * - Foto disponible: se muestra con <Image>.
 * - Video disponible: NO se puede mostrar con <Image> (no decodifica
 *   fotogramas de video), así que se muestra un ícono de cámara de
 *   video sobre fondo tintado, para diferenciarlo claramente de una foto.
 * - Sin archivo disponible (ej. certificado restaurado desde una copia
 *   de seguridad, que nunca incluye la foto): ícono neutro de "sin
 *   vista previa" (foto o video según corresponda). Se probó usar el
 *   escudo grande de nivel de confianza aquí, a todo color — pero en
 *   la grilla, con varias miniaturas juntas, se leía como un HUD de
 *   videojuego y duplicaba la insignia de confianza que ya muestra
 *   CertificatesScreen en la esquina. El color de confianza vive SOLO
 *   en esa insignia chica; este placeholder se mantiene neutro.
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
  style,
  iconSize = 22,
}: {
  uri?: string;
  mediaType?: 'image' | 'video';
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
});
