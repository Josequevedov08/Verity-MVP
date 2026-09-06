/**
 * CertificateCard.tsx
 * ---------------------------------------------------------------------------
 * Muestra el resultado final de un sello: miniatura, nivel de confianza,
 * y el enlace al registro público (blockchain) para que cualquiera pueda
 * verificarlo sin depender de Verity. Se usa tanto en CaptureScreen (recién
 * sellado) como en CertificatesScreen (historial).
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Linking, Pressable } from 'react-native';
import TrustLevelBadge from './TrustLevelBadge';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

export default function CertificateCard({
  certificate,
}: {
  certificate: VerityCertificate;
}) {
  return (
    <View style={styles.card}>
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

        <Pressable onPress={() => Linking.openURL(certificate.anchor.explorerUrl)}>
          <Text style={styles.link}>Ver en el registro público →</Text>
        </Pressable>
      </View>
    </View>
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
