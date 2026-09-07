/**
 * CertificateDetailModal.tsx
 * ---------------------------------------------------------------------------
 * El certificado como DOCUMENTO, no como una tarjeta más de app: foto con
 * marco, un sello real superpuesto (SealStamp) en vez de una pastilla de
 * color, y el número de sello mostrado de forma prominente. El enlace
 * externo al explorador de blockchain es una acción explícita al final,
 * nunca automática.
 *
 * IMPORTANTE (corregido tras feedback real de uso): antes se mostraba
 * un número "decorativo" acortado (primeros/últimos caracteres) como si
 * fuera EL número de sello, y más abajo el hash completo real bajo otro
 * nombre ("Número de sello completo") — confuso, y con riesgo real de
 * que alguien copiara el que no sirve para verificar. Ahora hay un solo
 * "Número de sello", siempre el hash completo y funcional, con
 * `letterSpacing` para que se vea como un serial (sin insertar espacios
 * de verdad en el texto — eso rompería la búsqueda al copiar/pegar).
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
            <Text style={[styles.title, { color: colors.text, fontFamily: FONT_DISPLAY }]}>
              Certificado
            </Text>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
              VERITY · REGISTRO PÚBLICO
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

            <View style={[styles.sealBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.serialLabel, { color: colors.textMuted }]}>Número de sello</Text>
              <Text style={[styles.serial, { color: colors.text }]} selectable>
                {certificate.anchor.txHash}
              </Text>
              <Text style={[styles.serialHint, { color: colors.textMuted }]}>
                Usa este número en la pestaña "Verificar" para comprobarlo.
              </Text>
            </View>

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
  title: { fontSize: 28, textAlign: 'center' },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  photoFrame: { alignSelf: 'center', marginBottom: 24 },
  photoBorder: {
    borderWidth: 4,
    borderRadius: 4,
    padding: 4,
  },
  thumbnail: { width: 220, height: 220, borderRadius: 2 },
  stampOverlay: { position: 'absolute', bottom: -20, right: -20 },
  sealOnly: { alignItems: 'center', marginBottom: 24 },
  sealBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  serialLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  serial: {
    fontSize: 15,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
    lineHeight: 22,
  },
  serialHint: { fontSize: 11, marginTop: 10, lineHeight: 15 },
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
