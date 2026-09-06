/**
 * TrustLevelBadge.tsx
 * ---------------------------------------------------------------------------
 * Insignia visual del nivel de confianza (ALTO/MEDIO/BAJO). Traduce el
 * criterio técnico (ver documentation/technical/verity-protocol.ts) a algo
 * que cualquier usuario entiende de un vistazo, con color + texto simple.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TrustLevel } from '../../documentation/technical/verity-protocol';

const TRUST_LEVEL_STYLE: Record<TrustLevel, { bg: string; label: string }> = {
  ALTO: { bg: '#1e8e3e', label: 'Confianza alta' },
  MEDIO: { bg: '#f9ab00', label: 'Confianza media' },
  BAJO: { bg: '#9aa0a6', label: 'Confianza baja' },
};

export default function TrustLevelBadge({ level }: { level: TrustLevel }) {
  const config = TRUST_LEVEL_STYLE[level];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={styles.text}>{config.label}</Text>
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
