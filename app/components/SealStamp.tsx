/**
 * SealStamp.tsx
 * ---------------------------------------------------------------------------
 * El nivel de confianza como un SELLO real (doble anillo, ícono y
 * etiqueta, ligeramente rotado) en vez de una pastilla de color plana.
 * Es el elemento visual central del "certificado como documento" — se
 * usa en el detalle completo (CertificateDetailModal) y en el momento
 * de estampado al terminar de sellar (CaptureScreen).
 */
import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { TrustLevel } from '../../documentation/technical/verity-protocol';
import { useTheme } from '../theme/ThemeContext';
import { FONT_DISPLAY } from '../theme/fonts';

const CONFIG: Record<TrustLevel, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ALTO: { label: 'ALTA', icon: 'shield-checkmark' },
  MEDIO: { label: 'MEDIA', icon: 'shield-half' },
  BAJO: { label: 'BAJA', icon: 'shield-outline' },
};

export default function SealStamp({
  level,
  size = 92,
  style,
}: {
  level: TrustLevel;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const color = level === 'ALTO' ? colors.success : level === 'MEDIO' ? colors.warning : colors.tabBarInactive;
  const { label, icon } = CONFIG[level];

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          // Fondo SÓLIDO (no transparente): antes el sello se volvía
          // ilegible sobre fotos con colores fuertes o muy claras,
          // porque solo tenía anillos sin relleno. Con esto se ve igual
          // de bien sobre cualquier imagen de fondo. La sombra lo
          // "levanta" visualmente de la foto, como un sello real de
          // relieve.
          backgroundColor: colors.background,
        },
        styles.shadow,
        style,
      ]}
    >
      <View style={[styles.inner, { borderColor: color, margin: size * 0.07 }]}>
        <Ionicons name={icon} size={size * 0.3} color={color} />
        <Text style={[styles.label, { color, fontFamily: FONT_DISPLAY, fontSize: size * 0.12 }]}>
          {label}
        </Text>
        <Text style={[styles.caption, { color }]}>CONFIANZA</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  inner: {
    flex: 1,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  label: { fontWeight: '700', letterSpacing: 1 },
  caption: { fontSize: 7, fontWeight: '700', letterSpacing: 1.5, opacity: 0.8 },
});
