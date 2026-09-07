/**
 * StatsCard.tsx
 * ---------------------------------------------------------------------------
 * Resumen rápido del uso de Verity en este teléfono — se muestra arriba
 * de "Mis sellos". Solo el conteo real de sellos y su desglose por
 * nivel de confianza — el estado del plan gratis/PRO vive únicamente
 * en Ajustes (fuente única de verdad), a propósito no se repite aquí.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

export default function StatsCard({ certificates }: { certificates: VerityCertificate[] }) {
  const { colors } = useTheme();

  const alto = certificates.filter((c) => c.trustLevel === 'ALTO').length;
  const medio = certificates.filter((c) => c.trustLevel === 'MEDIO').length;
  const bajo = certificates.filter((c) => c.trustLevel === 'BAJO').length;

  return (
    <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.totalRow}>
        <Text style={[styles.totalNumber, { color: colors.text }]}>{certificates.length}</Text>
        <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
          {certificates.length === 1 ? 'sello en este teléfono' : 'sellos en este teléfono'}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.breakdownRow}>
        <StatChip icon="shield-checkmark" color={colors.success} value={alto} label="Alta" />
        <StatChip icon="shield-half" color={colors.warning} value={medio} label="Media" />
        <StatChip icon="shield-outline" color={colors.tabBarInactive} value={bajo} label="Baja" />
      </View>
    </View>
  );
}

function StatChip({
  icon,
  color,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: number;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.chipValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  totalNumber: { fontSize: 30, fontWeight: '800' },
  totalLabel: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1, marginVertical: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipValue: { fontSize: 13, fontWeight: '800' },
  chipLabel: { fontSize: 11.5, fontWeight: '600' },
});
