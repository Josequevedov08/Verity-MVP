/**
 * StatsCard.tsx
 * ---------------------------------------------------------------------------
 * Resumen rápido del uso de Verity en este teléfono — se muestra arriba
 * de "Mis sellos". Solo el conteo real de sellos y su desglose por
 * nivel de confianza — el estado del plan gratis/PRO vive únicamente
 * en Ajustes (fuente única de verdad), a propósito no se repite aquí.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

/**
 * Mismo texto que handleTrustInfo() en CertificateDetailModal.tsx (el
 * ícono (i) que ya existe junto a la insignia de confianza de CADA
 * certificado) — se repite aquí a propósito, no se comparte código: el
 * usuario pidió explícitamente un segundo acceso a esta explicación
 * junto al título "NIVEL DE CONFIANZA" de este resumen, además del que
 * ya existe por certificado, "para doble seguridad y que la gente lea".
 */
function showTrustLevelInfo() {
  Alert.alert(
    '¿Qué significa el nivel de confianza?',
    'No dice si tu foto o video es real o falso: dice qué tanta información tenemos sobre CÓMO se tomó.\n\n' +
      '• Alta: se tomó con la cámara de Verity, con ubicación y hora confirmadas.\n' +
      '• Media: viene de tu galería, pero trae información de fecha (o es un video).\n' +
      '• Baja: no hay información extra disponible (común en fotos de galería sin esos datos, por ejemplo si te las mandaron por WhatsApp).\n\n' +
      'En los 3 casos el sello es igual de válido. La diferencia es solo cuánta evidencia extra tenemos sobre el origen.'
  );
}

/**
 * Abrevia números grandes (198567 → "198.5k") para que la fila de 3
 * cifras nunca reviente el ancho de la tarjeta — con miles de sellos
 * (alguien probando la app a fondo, o un futuro sellado en lote) los
 * conteos reales pueden crecer mucho, y un número de 6+ dígitos sin
 * abreviar rompería el layout de la fila.
 */
function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export default function StatsCard({ certificates }: { certificates: VerityCertificate[] }) {
  const { colors } = useTheme();

  const alto = certificates.filter((c) => c.trustLevel === 'ALTO').length;
  const medio = certificates.filter((c) => c.trustLevel === 'MEDIO').length;
  const bajo = certificates.filter((c) => c.trustLevel === 'BAJO').length;

  return (
    <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.totalRow}>
        <Text style={[styles.totalNumber, { color: colors.text }]} numberOfLines={1}>
          {formatCount(certificates.length)}
        </Text>
        <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
          {certificates.length === 1 ? 'sello en este teléfono' : 'sellos en este teléfono'}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Pressable style={styles.breakdownTitleRow} onPress={showTrustLevelInfo} hitSlop={8}>
        <Text style={[styles.breakdownTitle, { color: colors.textMuted }]}>NIVEL DE CONFIANZA</Text>
        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
      </Pressable>
      <View style={styles.breakdownRow}>
        <StatChip icon="shield-checkmark" color={colors.success} value={alto} label="Alta" />
        <StatChip icon="shield-half" color={colors.warning} value={medio} label="Media" />
        <StatChip icon="shield-outline" color={colors.tabBarInactive} value={bajo} label="Baja" />
      </View>
    </View>
  );
}

/**
 * `label` concuerda en número con `value` a propósito ("5 Altas", no
 * "5 Alta") — es un adjetivo acompañando una cantidad, así que debe
 * pluralizarse igual que "sello/sellos" arriba.
 */
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
      <Text style={[styles.chipValue, { color: colors.text }]} numberOfLines={1}>
        {formatCount(value)}
      </Text>
      <Text style={[styles.chipLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {value === 1 ? label : `${label}s`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  totalNumber: { fontSize: 30, fontWeight: '800', flexShrink: 1 },
  totalLabel: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  divider: { height: 1, marginVertical: 12 },
  breakdownTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10, alignSelf: 'flex-start' },
  breakdownTitle: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
  // flexWrap + cada chip con flexBasis/flexShrink: si con números
  // abreviados TODAVÍA no cupieran los 3 en una fila (pantallas muy
  // angostas), se acomodan en 2 líneas en vez de desbordar o superponerse.
  breakdownRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minWidth: '30%' },
  chipValue: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  chipLabel: { fontSize: 11.5, fontWeight: '600', flexShrink: 1 },
});
