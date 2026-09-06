/**
 * CertificateCard.tsx
 * ---------------------------------------------------------------------------
 * Muestra el resultado de un sello: miniatura, nivel de confianza y datos
 * básicos. Al tocar la tarjeta se abre el detalle completo DENTRO de la
 * app (ver CertificateDetailModal.tsx) — ya no se sale directo al
 * navegador. Se usa tanto en CaptureScreen (recién sellado) como en
 * CertificatesScreen (historial).
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import TrustLevelBadge from './TrustLevelBadge';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

export default function CertificateCard({
  certificate,
  onPress,
}: {
  certificate: VerityCertificate;
  /** Si se pasa, la tarjeta es tocable y abre el detalle completo. */
  onPress?: () => void;
}) {
  const CardWrapper = onPress ? Pressable : View;

  return (
    <CardWrapper style={styles.card} onPress={onPress}>
      {certificate.thumbnailUri && (
        <Image source={{ uri: certificate.thumbnailUri }} style={styles.thumbnail} />
      )}

      <View style={styles.info}>
        <TrustLevelBadge level={certificate.trustLevel} />

        <Text style={styles.label}>Huella digital</Text>
        <Text style={styles.mono} numberOfLines={1}>
          {certificate.sha256}
        </Text>

        <Text style={styles.label}>Sellado el</Text>
        <Text style={styles.value}>
          {new Date(certificate.anchor.anchoredAt).toLocaleString()}
        </Text>

        {onPress && <Text style={styles.link}>Ver detalle completo →</Text>}
      </View>
    </CardWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f7f8fa',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  thumbnail: { width: 72, height: 72, borderRadius: 12 },
  info: { flex: 1, gap: 4 },
  label: { fontSize: 11, color: '#888', marginTop: 6 },
  value: { fontSize: 13, color: '#222' },
  mono: { fontSize: 12, color: '#222', fontFamily: 'monospace' },
  link: { fontSize: 13, color: '#1a73e8', marginTop: 8, fontWeight: '600' },
});
