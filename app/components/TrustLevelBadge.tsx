/**
 * TrustLevelBadge.tsx
 * ---------------------------------------------------------------------------
 * Insignia visual del nivel de confianza (ALTO/MEDIO/BAJO). Traduce el
 * criterio técnico (ver documentation/technical/verity-protocol.ts) a algo
 * que cualquier usuario entiende de un vistazo. Pastilla con CONTORNO de
 * color (no relleno sólido) — mismo lenguaje visual que la pastilla de
 * estado del certificado (CertificateDetailModal), para que se vea
 * coherente en toda la app: lista, detalle, resultados de verificación.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TrustLevel } from '../../documentation/technical/verity-protocol';
import { useTheme } from '../theme/ThemeContext';

export default function TrustLevelBadge({ level }: { level: TrustLevel }) {
  const { colors } = useTheme();

  const config: Record<TrustLevel, { color: string; label: string }> = {
    ALTO: { color: colors.success, label: 'CONFIANZA ALTA' },
    MEDIO: { color: colors.warning, label: 'CONFIANZA MEDIA' },
    BAJO: { color: colors.tabBarInactive, label: 'CONFIANZA BAJA' },
  };
  const { color, label } = config[level];

  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  text: { fontWeight: '800', fontSize: 10.5, letterSpacing: 0.4 },
});
