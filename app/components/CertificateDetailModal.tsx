/**
 * CertificateDetailModal.tsx
 * ---------------------------------------------------------------------------
 * El certificado como una tarjeta de documento flotante (diseño validado
 * con el usuario mediante mockups): insignia azul de marca + título,
 * foto de referencia, fila de datos, una lista de evidencia de origen
 * (dinámica según los metadatos reales del certificado, no fija), y una
 * pastilla de estado con el nivel de confianza al final.
 *
 * El enlace externo al explorador de blockchain sigue siendo una acción
 * secundaria y explícita — nunca automática.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Modal, Pressable, Linking, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
        style={[styles.page, { backgroundColor: colors.surface }]}
        contentContainerStyle={{ padding: 20, paddingTop: 12 }}
      >
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: colors.accent }]}>Cerrar ✕</Text>
        </Pressable>

        {certificate && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            {/* Encabezado: insignia + título + referencia, foto a la derecha */}
            <View style={styles.header}>
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Ionicons name="shield-checkmark" size={22} color={colors.accentText} />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: colors.text }]}>CERTIFICADO VERITY</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  Ref. {shortRef(certificate.anchor.txHash)} · Polygon Amoy
                </Text>
              </View>
              {certificate.thumbnailUri && (
                <Image source={{ uri: certificate.thumbnailUri }} style={[styles.photo, { borderColor: colors.border }]} />
              )}
            </View>

            <View style={[styles.dashedDivider, { borderColor: colors.border }]} />

            {/* Datos del sello */}
            <DataRow label="Huella digital (SHA-256)" value={middleTruncate(certificate.sha256, 8, 14)} />
            <DataRow label="Número de sello" value={middleTruncate(certificate.anchor.txHash, 8, 8)} />
            <DataRow label="Sellado por" value={middleTruncate(certificate.anchor.walletAddress, 6, 6)} />
            <DataRow label="Fecha" value={formatDate(certificate.anchor.anchoredAt)} />
            <DataRow label="Red" value="Polygon Amoy (testnet)" last />

            {/* Evidencia de origen — dinámica según los metadatos reales */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ORIGEN DEL ARCHIVO</Text>
            <EvidenceLine
              ok={certificate.metadata.source === 'camera'}
              trueText="Capturado con la cámara de la app"
              falseText="Elegido desde la galería (no desde la cámara de la app)"
            />
            <EvidenceLine
              ok={!!(certificate.metadata.latitude && certificate.metadata.longitude)}
              trueText="Ubicación GPS registrada"
              falseText="Sin ubicación GPS disponible"
            />
            <EvidenceLine
              ok={!!certificate.metadata.capturedAt}
              trueText="Hora de captura verificada"
              falseText="Sin metadatos de fecha verificables"
            />

            {/* Estado final: nivel de confianza */}
            <TrustPill level={certificate.trustLevel} />

            <Text
              style={[styles.hashFull, { color: colors.textMuted }]}
              selectable
              numberOfLines={2}
            >
              Número de sello completo: {certificate.anchor.txHash}
            </Text>

            <Pressable onPress={() => Linking.openURL(certificate.anchor.explorerUrl)}>
              <Text style={[styles.externalLink, { color: colors.accent }]}>
                Abrir en el navegador (registro público) ↗
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Modal>
  );
}

/** Trunca un hash/dirección larga a "primeros...últimos" para mostrar, sin perder el valor real (se muestra completo y seleccionable más abajo). */
function middleTruncate(value: string, head: number, tail: number): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

/** Referencia corta puramente decorativa para el subtítulo (NO es el número de sello a usar en Verificar — ese es el completo, mostrado abajo). */
function shortRef(txHash: string): string {
  const clean = txHash.startsWith('0x') ? txHash.slice(2) : txHash;
  return `#${clean.slice(0, 6).toUpperCase()}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
}

function DataRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.dataRow, !last && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <Text style={[styles.dataLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function EvidenceLine({ ok, trueText, falseText }: { ok: boolean; trueText: string; falseText: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.evidenceLine}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle-outline'}
        size={18}
        color={ok ? colors.success : colors.textMuted}
      />
      <Text style={[styles.evidenceText, { color: ok ? colors.text : colors.textMuted }]}>
        {ok ? trueText : falseText}
      </Text>
    </View>
  );
}

function TrustPill({ level }: { level: VerityCertificate['trustLevel'] }) {
  const { colors } = useTheme();
  const color = level === 'ALTO' ? colors.success : level === 'MEDIO' ? colors.warning : colors.tabBarInactive;
  const label = level === 'ALTO' ? 'CONFIANZA ALTA' : level === 'MEDIO' ? 'CONFIANZA MEDIA' : 'CONFIANZA BAJA';
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  closeButton: { alignSelf: 'flex-end', marginBottom: 8 },
  closeText: { fontSize: 15, fontWeight: '600' },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { fontSize: 12, marginTop: 2 },
  photo: { width: 56, height: 56, borderRadius: 10, borderWidth: 1 },
  dashedDivider: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 18 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  dataLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, maxWidth: '45%' },
  dataValue: { fontSize: 13, fontFamily: 'monospace', fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  sectionLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, marginTop: 20, marginBottom: 10 },
  evidenceLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  evidenceText: { fontSize: 13, flex: 1 },
  pill: {
    marginTop: 20,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pillText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  hashFull: { fontSize: 10.5, fontFamily: 'monospace', marginTop: 14, lineHeight: 15 },
  externalLink: { fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' },
});
