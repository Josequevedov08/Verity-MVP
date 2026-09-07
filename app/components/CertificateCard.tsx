/**
 * CertificateCard.tsx
 * ---------------------------------------------------------------------------
 * Fila compacta de la lista "Mis sellos": miniatura, insignia de nivel de
 * confianza y datos básicos. Al tocar la tarjeta se abre el detalle
 * completo DENTRO de la app (CertificateDetailModal.tsx). Se usa tanto en
 * CaptureScreen (recién sellado) como en CertificatesScreen (historial).
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import TrustLevelBadge from './TrustLevelBadge';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';
import { useTheme } from '../theme/ThemeContext';

export default function CertificateCard({
  certificate,
  onPress,
}: {
  certificate: VerityCertificate;
  /** Si se pasa, la tarjeta es tocable y abre el detalle completo. */
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const CardWrapper = onPress ? Pressable : View;

  return (
    <CardWrapper
      style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
      onPress={onPress}
    >
      {certificate.thumbnailUri && (
        <Image source={{ uri: certificate.thumbnailUri }} style={styles.thumbnail} />
      )}

      <View style={styles.info}>
        <TrustLevelBadge level={certificate.trustLevel} />

        <Text style={[styles.label, { color: colors.textMuted }]}>Huella digital</Text>
        <Text style={[styles.mono, { color: colors.text }]} numberOfLines={1}>
          {certificate.sha256}
        </Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>Sellado el</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {new Date(certificate.anchor.anchoredAt).toLocaleString()}
        </Text>

        {onPress && (
          <Text style={[styles.link, { color: colors.accent }]}>Ver detalle completo →</Text>
        )}
      </View>
    </CardWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  thumbnail: { width: 72, height: 72, borderRadius: 12 },
  info: { flex: 1, gap: 4 },
  label: { fontSize: 11, marginTop: 6 },
  value: { fontSize: 13 },
  mono: { fontSize: 12, fontFamily: 'monospace' },
  link: { fontSize: 13, marginTop: 8, fontWeight: '600' },
});
