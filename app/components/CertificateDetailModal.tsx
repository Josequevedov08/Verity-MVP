/**
 * CertificateDetailModal.tsx
 * ---------------------------------------------------------------------------
 * El certificado como una tarjeta de documento flotante: insignia azul de
 * marca + título, foto de referencia, fila de datos, evidencia de origen
 * (dinámica según los metadatos reales), y una pastilla de estado con el
 * nivel de confianza.
 *
 * Si se le pasa `certificates` (la lista completa donde vive este
 * certificado — ej. el historial de "Mis sellos"), se puede deslizar el
 * dedo izquierda/derecha para pasar al sello anterior/siguiente sin
 * cerrar el detalle. Esto usa un FlatList horizontal con paginación
 * NATIVA (no un gesto hecho a mano) — es más confiable dentro de un
 * contenido que también se desplaza verticalmente, y el "rebote" en los
 * extremos lo da gratis el sistema (efecto de borde de Android/iOS), sin
 * necesitar animación personalizada.
 *
 * El enlace externo al explorador de blockchain sigue siendo una acción
 * secundaria y explícita — nunca automática. "Compartir" comparte la
 * foto de verdad (antes el texto decía "listo para compartir" pero no
 * existía ningún botón) y copia el mensaje de verificación al
 * portapapeles para pegar junto con la foto.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Linking,
  ScrollView,
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import MediaThumbnail from './MediaThumbnail';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';
import { useTheme } from '../theme/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function CertificateDetailModal({
  certificate,
  certificates,
  visible,
  onClose,
}: {
  certificate: VerityCertificate | null;
  /** Lista completa donde vive `certificate` (opcional). Si tiene más de
   * un elemento, habilita deslizar entre sellos dentro del detalle. */
  certificates?: VerityCertificate[];
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  const list = certificates && certificates.length > 1 ? certificates : null;
  const initialIndex = list && certificate ? Math.max(0, list.findIndex((c) => c.id === certificate.id)) : 0;

  function handleMomentumEnd(offsetX: number) {
    const newIndex = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(newIndex);
  }

  return (
    <Modal
      visible={visible && !!certificate}
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setCurrentIndex(initialIndex)}
    >
      <View style={[styles.page, { backgroundColor: colors.surface }]}>
        <View style={styles.topBar}>
          {list && (
            <Text style={[styles.counter, { color: colors.textMuted }]}>
              {currentIndex + 1} de {list.length} · desliza para ver más
            </Text>
          )}
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.accent }]}>Cerrar ✕</Text>
          </Pressable>
        </View>

        {list ? (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_data, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
            onMomentumScrollEnd={(e) => handleMomentumEnd(e.nativeEvent.contentOffset.x)}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH }}>
                <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }}>
                  <CertificateDocument certificate={item} />
                </ScrollView>
              </View>
            )}
          />
        ) : (
          certificate && (
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }}>
              <CertificateDocument certificate={certificate} />
            </ScrollView>
          )
        )}
      </View>
    </Modal>
  );
}

function CertificateDocument({ certificate }: { certificate: VerityCertificate }) {
  const { colors } = useTheme();
  const mediaLabel = certificate.metadata.mediaType === 'video' ? 'video' : 'foto';

  /**
   * Comparte el archivo por el panel nativo (WhatsApp, correo, etc.) Y
   * copia un mensaje de verificación al portapapeles, para que se pegue
   * junto con el archivo en el mismo chat. No existe una forma confiable
   * en Android/iOS de adjuntar archivo + texto libre en un solo
   * "compartir" sin salir de Expo Go, así que se resuelve en dos pasos
   * explícitos (el usuario ve un aviso claro de qué está pasando en cada uno).
   */
  async function handleShare() {
    const message =
      `Este/a ${mediaLabel} fue sellado/a con Verity. Número de sello: ${certificate.anchor.txHash} ` +
      `— compruébalo en ${certificate.anchor.explorerUrl}`;

    await Clipboard.setStringAsync(message);

    if (certificate.thumbnailUri) {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        Alert.alert(
          'Número de sello copiado',
          `Se copió el mensaje de verificación al portapapeles. A continuación comparte el/la ${mediaLabel}, y pega el mensaje en el mismo chat para que puedan validarlo.`,
          [{ text: 'Entendido', onPress: () => Sharing.shareAsync(certificate.thumbnailUri!) }]
        );
        return;
      }
    }

    Alert.alert(
      'Mensaje de verificación copiado',
      'Pégalo donde quieras compartirlo — incluye el número de sello y el enlace para comprobarlo.'
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
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
        <MediaThumbnail
          uri={certificate.thumbnailUri}
          mediaType={certificate.metadata.mediaType}
          style={[styles.photo, { borderColor: colors.border }]}
          iconSize={22}
        />
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

      <CopyableHash label="Número de sello completo" value={certificate.anchor.txHash} />

      <Pressable style={[styles.shareButton, { backgroundColor: colors.accent }]} onPress={handleShare}>
        <Ionicons name="share-social-outline" size={16} color={colors.accentText} />
        <Text style={[styles.shareButtonText, { color: colors.accentText }]}>
          Compartir {mediaLabel} y sello
        </Text>
      </Pressable>

      <Pressable onPress={() => Linking.openURL(certificate.anchor.explorerUrl)}>
        <Text style={[styles.externalLink, { color: colors.accent }]}>
          Abrir en el navegador (registro público) ↗
        </Text>
      </Pressable>
    </View>
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

/**
 * Bloque tocable que copia el hash completo al portapapeles y muestra
 * una confirmación breve ("Copiado ✓") antes de volver a su estado
 * normal.
 */
function CopyableHash({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Pressable
      onPress={handleCopy}
      style={[styles.copyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.copyLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.copyValue, { color: colors.text }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
      <View style={styles.copyIconCol}>
        <Ionicons
          name={copied ? 'checkmark-circle' : 'copy-outline'}
          size={20}
          color={copied ? colors.success : colors.accent}
        />
        <Text style={[styles.copyHint, { color: copied ? colors.success : colors.accent }]}>
          {copied ? 'Copiado' : 'Copiar'}
        </Text>
      </View>
    </Pressable>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  counter: { fontSize: 12, fontWeight: '600' },
  closeButton: { marginLeft: 'auto' },
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
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
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
  copyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  copyLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, marginBottom: 3 },
  copyValue: { fontSize: 11, fontFamily: 'monospace', lineHeight: 15 },
  copyIconCol: { alignItems: 'center', gap: 2, minWidth: 44 },
  copyHint: { fontSize: 9.5, fontWeight: '700' },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareButtonText: { fontWeight: '700', fontSize: 14 },
  externalLink: { fontSize: 13, fontWeight: '600', marginTop: 14, textAlign: 'center' },
});
