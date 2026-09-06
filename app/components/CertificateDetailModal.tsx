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

export default function CertificateDetailModal({
  certificate,
  visible,
  onClose,
}: {
  certificate: VerityCertificate | null;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible && !!certificate} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>Cerrar ✕</Text>
        </Pressable>

        {certificate && (
          <>
            <Text style={styles.title}>Detalle del sello</Text>

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
              style={styles.externalButton}
              onPress={() => Linking.openURL(certificate.anchor.explorerUrl)}
            >
              <Text style={styles.externalButtonText}>Abrir en el navegador (registro público) ↗</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  closeButton: { alignSelf: 'flex-end', marginBottom: 12 },
  closeText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  thumbnail: { width: '100%', height: 220, borderRadius: 16, marginBottom: 16 },
  row: { marginTop: 16 },
  rowLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  rowValue: { fontSize: 14, color: '#222' },
  mono: { fontFamily: 'monospace' },
  externalButton: {
    marginTop: 28,
    backgroundColor: '#eef2f7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  externalButtonText: { color: '#1a73e8', fontWeight: '600' },
});
