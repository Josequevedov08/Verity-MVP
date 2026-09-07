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
 * cerrar el detalle. Si no hay más sellos en esa dirección, la tarjeta
 * "rebota" en vez de moverse — así el usuario siente que llegó al final,
 * no que el gesto no hizo nada.
 *
 * El enlace externo al explorador de blockchain sigue siendo una acción
 * secundaria y explícita — nunca automática.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  Pressable,
  Linking,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';
import { useTheme } from '../theme/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 90;

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
  const [activeCert, setActiveCert] = useState<VerityCertificate | null>(certificate);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Cada vez que se abre el modal con un certificado distinto, empezamos
  // desde ESE (no desde donde había quedado la última vez que se cerró).
  useEffect(() => {
    if (visible) {
      setActiveCert(certificate);
      translateX.setValue(0);
      opacity.setValue(1);
    }
  }, [visible, certificate]);

  const list = certificates ?? [];
  const index = activeCert ? list.findIndex((c) => c.id === activeCert.id) : -1;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < list.length - 1;
  const swipeEnabled = list.length > 1 && index >= 0;

  function goTo(newIndex: number, direction: 'next' | 'prev') {
    const offscreen = direction === 'next' ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.parallel([
      Animated.timing(translateX, { toValue: offscreen, duration: 160, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setActiveCert(list[newIndex]);
      translateX.setValue(-offscreen);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  function bounceBack() {
    Animated.spring(translateX, { toValue: 0, friction: 4, tension: 80, useNativeDriver: true }).start();
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_evt, gesture) =>
      swipeEnabled && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderMove: (_evt, gesture) => {
      const goingNext = gesture.dx < 0;
      const blocked = (goingNext && !hasNext) || (!goingNext && !hasPrev);
      // Resistencia: si no hay sello en esa dirección, el dedo se mueve
      // pero la tarjeta apenas se desplaza (efecto "tope de goma").
      translateX.setValue(blocked ? gesture.dx * 0.28 : gesture.dx);
    },
    onPanResponderRelease: (_evt, gesture) => {
      if (gesture.dx <= -SWIPE_THRESHOLD && hasNext) {
        goTo(index + 1, 'next');
      } else if (gesture.dx >= SWIPE_THRESHOLD && hasPrev) {
        goTo(index - 1, 'prev');
      } else {
        bounceBack();
      }
    },
    onPanResponderTerminate: bounceBack,
  });

  return (
    <Modal visible={visible && !!activeCert} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.page, { backgroundColor: colors.surface }]}>
        <View style={styles.topBar}>
          {swipeEnabled && (
            <Text style={[styles.counter, { color: colors.textMuted }]}>
              {index + 1} de {list.length}
            </Text>
          )}
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.accent }]}>Cerrar ✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }}>
          {activeCert && (
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.card,
                { backgroundColor: colors.background, borderColor: colors.border },
                { opacity, transform: [{ translateX }] },
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
                    Ref. {shortRef(activeCert.anchor.txHash)} · Polygon Amoy
                  </Text>
                </View>
                {activeCert.thumbnailUri && (
                  <Image source={{ uri: activeCert.thumbnailUri }} style={[styles.photo, { borderColor: colors.border }]} />
                )}
              </View>

              <View style={[styles.dashedDivider, { borderColor: colors.border }]} />

              {/* Datos del sello */}
              <DataRow label="Huella digital (SHA-256)" value={middleTruncate(activeCert.sha256, 8, 14)} />
              <DataRow label="Número de sello" value={middleTruncate(activeCert.anchor.txHash, 8, 8)} />
              <DataRow label="Sellado por" value={middleTruncate(activeCert.anchor.walletAddress, 6, 6)} />
              <DataRow label="Fecha" value={formatDate(activeCert.anchor.anchoredAt)} />
              <DataRow label="Red" value="Polygon Amoy (testnet)" last />

              {/* Evidencia de origen — dinámica según los metadatos reales */}
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ORIGEN DEL ARCHIVO</Text>
              <EvidenceLine
                ok={activeCert.metadata.source === 'camera'}
                trueText="Capturado con la cámara de la app"
                falseText="Elegido desde la galería (no desde la cámara de la app)"
              />
              <EvidenceLine
                ok={!!(activeCert.metadata.latitude && activeCert.metadata.longitude)}
                trueText="Ubicación GPS registrada"
                falseText="Sin ubicación GPS disponible"
              />
              <EvidenceLine
                ok={!!activeCert.metadata.capturedAt}
                trueText="Hora de captura verificada"
                falseText="Sin metadatos de fecha verificables"
              />

              {/* Estado final: nivel de confianza */}
              <TrustPill level={activeCert.trustLevel} />

              <CopyableHash label="Número de sello completo" value={activeCert.anchor.txHash} />

              <Pressable onPress={() => Linking.openURL(activeCert.anchor.explorerUrl)}>
                <Text style={[styles.externalLink, { color: colors.accent }]}>
                  Abrir en el navegador (registro público) ↗
                </Text>
              </Pressable>

              {swipeEnabled && (
                <View style={styles.swipeHintRow}>
                  {hasPrev && (
                    <View style={styles.swipeHint}>
                      <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
                      <Text style={[styles.swipeHintText, { color: colors.textMuted }]}>anterior</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  {hasNext && (
                    <View style={styles.swipeHint}>
                      <Text style={[styles.swipeHintText, { color: colors.textMuted }]}>siguiente</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </View>
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
  externalLink: { fontSize: 13, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  swipeHintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  swipeHintText: { fontSize: 10.5, fontWeight: '600' },
});
