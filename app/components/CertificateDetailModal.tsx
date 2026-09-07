/**
 * CertificateDetailModal.tsx
 * ---------------------------------------------------------------------------
 * El certificado como DOCUMENTO, no como una tarjeta más de app: foto con
 * marco, un sello real superpuesto (SealStamp) en vez de una pastilla de
 * color, y el número de sello mostrado grande, como el serial de un
 * billete. El enlace externo al explorador de blockchain es una acción
 * explícita al final, nunca automática.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Modal, Pressable, Linking, ScrollView } from 'react-native';
import SealStamp from './SealStamp';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';
import { useTheme } from '../theme/ThemeContext';
import { FONT_DISPLAY } from '../theme/fonts';

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
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
              CERTIFICADO DIGITAL · VERITY
            </Text>

            {certificate.thumbnailUri && (
              <View style={styles.photoFrame}>
                <View style={[styles.photoBorder, { borderColor: colors.border }]}>
                  <Image source={{ uri: certificate.thumbnailUri }} style={styles.thumbnail} />
                </View>
                <SealStamp level={certificate.trustLevel} style={styles.stampOverlay} />
              </View>
            )}
            {!certificate.thumbnailUri && (
              <View style={styles.sealOnly}>
                <SealStamp level={certificate.trustLevel} />
              </View>
            )}

            <Text style={[styles.serialLabel, { color: colors.textMuted }]}>Número de sello</Text>
            <Text
              style={[styles.serial, { color: colors.text, fontFamily: FONT_DISPLAY }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              selectable
            >
              {shortHash(certificate.anchor.txHash)}
            </Text>

            <View style={[styles.divider, { borderColor: colors.border }]} />

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
            <Row label="Número de sello completo" value={certificate.anchor.txHash} mono />
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

/** Muestra los primeros y últimos caracteres del hash, como el serial de un billete. */
function shortHash(hash: string): string {
  const clean = hash.startsWith('0x') ? hash.slice(2) : hash;
  return `${clean.slice(0, 6).toUpperCase()} · ${clean.slice(-6).toUpperCase()}`;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
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
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 20,
  },
  photoFrame: { alignSelf: 'center', marginBottom: 12 },
  photoBorder: {
    borderWidth: 4,
    borderRadius: 4,
    padding: 4,
  },
  thumbnail: { width: 220, height: 220, borderRadius: 2 },
  stampOverlay: { position: 'absolute', bottom: -20, right: -20 },
  sealOnly: { alignItems: 'center', marginBottom: 12 },
  serialLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 20,
  },
  serial: {
    fontSize: 26,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 4,
  },
  divider: { borderTopWidth: 1, borderStyle: 'dashed', marginTop: 20 },
  row: { paddingVertical: 14, borderBottomWidth: 1 },
  rowLabel: { fontSize: 11, marginBottom: 4, letterSpacing: 0.5 },
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
