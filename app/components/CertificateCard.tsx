/**
 * CertificateCard.tsx
 * ---------------------------------------------------------------------------
 * Muestra el resultado de un sello: miniatura con el sello superpuesto
 * (mismo SealStamp que en el detalle completo, en tamaño reducido — antes
 * la lista y el detalle se veían como dos diseños distintos) y datos
 * básicos. Al tocar la tarjeta se abre el detalle completo DENTRO de la
 * app. Se usa tanto en CaptureScreen (recién sellado) como en
 * CertificatesScreen (historial).
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import SealStamp from './SealStamp';
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
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
    >
      {certificate.thumbnailUri ? (
        <View style={styles.thumbnailWrap}>
          <Image source={{ uri: certificate.thumbnailUri }} style={styles.thumbnail} />
          <SealStamp level={certificate.trustLevel} size={34} style={styles.miniStamp} />
        </View>
      ) : (
        // Sin miniatura (poco común): se usa la insignia plana en vez del
        // sello, que necesita apoyarse sobre una foto para verse bien.
        <View style={styles.badgeFallback}>
          <TrustLevelBadge level={certificate.trustLevel} />
        </View>
      )}

      <View style={styles.info}>
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
    gap: 14,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  thumbnailWrap: { width: 72, height: 72 },
  thumbnail: { width: 72, height: 72, borderRadius: 12 },
  miniStamp: { position: 'absolute', bottom: -8, right: -8 },
  badgeFallback: { justifyContent: 'center' },
  info: { flex: 1, gap: 4 },
  label: { fontSize: 11, marginTop: 6 },
  value: { fontSize: 13 },
  mono: { fontSize: 12, fontFamily: 'monospace' },
  link: { fontSize: 13, marginTop: 8, fontWeight: '600' },
});
