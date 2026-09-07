/**
 * MediaThumbnail.tsx
 * ---------------------------------------------------------------------------
 * Miniatura de un certificado, con 3 estados posibles:
 * - Foto disponible: se muestra con <Image>.
 * - Video disponible: NO se puede mostrar con <Image> (no decodifica
 *   fotogramas de video), así que se muestra un ícono de cámara de
 *   video sobre fondo tintado, para diferenciarlo claramente de una foto.
 * - Sin archivo disponible (ej. certificado restaurado desde una copia
 *   de seguridad, que nunca incluye la foto): antes se mostraba un
 *   ícono gris de "documento con candado", muy pequeño sobre un fondo
 *   plano — de lejos se leía como un ícono roto, no como un estado
 *   intencional. Ahora se reutiliza el mismo lenguaje visual que ya
 *   funciona bien (la insignia de escudo de nivel de confianza): un
 *   escudo grande del color correspondiente (verde/ámbar/gris) sobre
 *   un fondo tintado del mismo color, así el "default" ya comunica
 *   algo por sí solo en vez de sentirse un espacio vacío.
 *
 * Se usa en CertificateCard, CertificatesScreen (grilla) y
 * CertificateDetailModal — antes cada uno repetía esta lógica.
 */
import React from 'react';
import { View, Image, StyleSheet, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

export default function MediaThumbnail({
  uri,
  mediaType,
  trustLevel,
  style,
  iconSize = 22,
}: {
  uri?: string;
  mediaType?: 'image' | 'video';
  /** Nivel de confianza del certificado — colorea el ícono por defecto
   * cuando no hay foto/video disponible localmente. */
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

  if (uri && mediaType === 'video') {
    return (
      <View style={[viewStyle, styles.placeholder, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="videocam" size={iconSize} color={colors.accent} />
      </View>
    );
  }

  const trustIcon =
    trustLevel === 'ALTO' ? 'shield-checkmark' : trustLevel === 'MEDIO' ? 'shield-half' : 'shield-outline';
  const trustColor =
    trustLevel === 'ALTO' ? colors.success : trustLevel === 'MEDIO' ? colors.warning : colors.tabBarInactive;

  return (
    <View style={[viewStyle, styles.placeholder, { backgroundColor: `${trustColor}22` }]}>
      <Ionicons name={trustIcon} size={Math.round(iconSize * 1.6)} color={trustColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
