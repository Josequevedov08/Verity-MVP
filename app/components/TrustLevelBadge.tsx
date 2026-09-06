/**
 * TrustLevelBadge.tsx
 * ---------------------------------------------------------------------------
 * Insignia visual del nivel de confianza (ALTO/MEDIO/BAJO). Traduce el
 * criterio técnico (ver documentation/technical/verity-protocol.ts) a algo
 * que cualquier usuario entiende de un vistazo, con color + texto simple.
 * Los colores semánticos (verde/ámbar/gris) vienen del tema para que se
 * vean bien tanto en modo claro como oscuro.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TrustLevel } from '../../documentation/technical/verity-protocol';
import { useTheme } from '../theme/ThemeContext';

export default function TrustLevelBadge({ level }: { level: TrustLevel }) {
  const { colors } = useTheme();

  const config: Record<TrustLevel, { bg: string; label: string }> = {
    ALTO: { bg: colors.success, label: 'Confianza alta' },
    MEDIO: { bg: colors.warning, label: 'Confianza media' },
    BAJO: { bg: colors.tabBarInactive, label: 'Confianza baja' },
  };

  return (
    <View style={[styles.badge, { backgroundColor: config[level].bg }]}>
      <Text style={styles.text}>{config[level].label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  text: { color: '#fff', fontWeight: '600', fontSize: 12 },
});
