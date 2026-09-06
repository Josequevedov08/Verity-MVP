/**
 * CertificateDetailModal.tsx
 * ---------------------------------------------------------------------------
 * Muestra el detalle completo de un certificado SIN salir de la app (a
 * diferencia de antes, que abría directamente el navegador al tocar "Ver
 * en el registro público"). El enlace externo al explorador de blockchain
 * ahora es una acción explícita dentro de este detalle, no automática.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Modal, Pressable, Linking, ScrollView } from 'react-native';
import TrustLevelBadge from './TrustLevelBadge';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';
import { useTheme } from '../theme/ThemeContext';

export default function CertificateDetailModal({
  certificate,
  visible,
  onClose,
}: {
  certificate: VerityCertificate | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible && !!certificate} animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: 24 }}
      >
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: colors.accent }]}>Cerrar ✕</Text>
        </Pressable>

        {certificate && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Detalle del sello</Text>

            {certificate.thumbnailUri && (
              <Image source={{ uri: certificate.thumbnailUri }} style={styles.thumbnail} />
            )}

            <TrustLevelBadge level={certificate.trustLevel} />

            <Row label="Huella digital (SHA-256)" value={certificate.sha256} mono />
            <Row
              label="Sellado el"
              value={new Date(certificate.anchor.anchoredAt).toLocaleString()}
            />
            <Row label="Origen" value={certificate.metadata.source === 'camera' ? 'Cámara de la app' : 'Galería'} />
            {certificate.metadata.latitude && certificate.metadata.longitude && (
              <Row
                label="Ubicación"
                value={`${certificate.metadata.latitude.toFixed(5)}, ${certificate.metadata.longitude.toFixed(5)}`}
              />
            )}
            <Row label="Número de sello (hash de transacción)" value={certificate.anchor.txHash} mono />
            <Row label="Wallet del dispositivo" value={certificate.anchor.walletAddress} mono />

            <Pressable
              style={[styles.externalButton, { backgroundColor: colors.surfaceAlt }]}
              onPress={() => Linking.openURL(certificate.anchor.explorerUrl)}
            >
              <Text style={[styles.externalButtonText, { color: colors.accent }]}>
                Abrir en el navegador (registro público) ↗
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeButton: { alignSelf: 'flex-end', marginBottom: 12 },
  closeText: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  thumbnail: { width: '100%', height: 220, borderRadius: 16, marginBottom: 16 },
  row: { marginTop: 16 },
  rowLabel: { fontSize: 12, marginBottom: 4 },
  rowValue: { fontSize: 14 },
  mono: { fontFamily: 'monospace' },
  externalButton: {
    marginTop: 28,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  externalButtonText: { fontWeight: '600' },
});
