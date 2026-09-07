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
  FlatList,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
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
  const isVideo = certificate.metadata.mediaType === 'video';
  // thumbnailUri es el ARCHIVO real (foto o video), no solo una miniatura
  // — para video, se usa directo como fuente de reproducción real (con
  // expo-video), no solo el frame estático (previewImageUri es únicamente
  // para las miniaturas chicas de lista/grilla). Si no hay archivo local
  // (ej. certificado restaurado desde backup), tocar la carta no hace
  // nada — no hay nada que mostrar.
  const canFlip = !!certificate.thumbnailUri;

  const [flipped, setFlipped] = useState(false);
  const flip = useRef(new Animated.Value(0)).current; // 0 = frente, 180 = reverso
  const isAnimating = useRef(false);
  const flipBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Tocar la carta alterna frente/reverso. Para FOTO, además vuelve sola
   * al frente a los ~2s (un vistazo rápido). Para VIDEO no hay auto-
   * retorno: interrumpiría la reproducción justo cuando el usuario la
   * empieza a ver — ahí toca la carta de nuevo (o los controles nativos)
   * para volver.
   */
  function handleCardTap() {
    if (!canFlip || isAnimating.current) return;
    if (flipBackTimer.current) {
      clearTimeout(flipBackTimer.current);
      flipBackTimer.current = null;
    }
    isAnimating.current = true;
    const goingToBack = !flipped;
    Animated.spring(flip, {
      toValue: goingToBack ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false;
      setFlipped(goingToBack);
      if (goingToBack && !isVideo) {
        flipBackTimer.current = setTimeout(() => {
          isAnimating.current = true;
          Animated.spring(flip, { toValue: 0, friction: 8, tension: 10, useNativeDriver: true }).start(() => {
            isAnimating.current = false;
            setFlipped(false);
          });
        }, 2200);
      }
    });
  }

  const frontRotate = flip.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] });
  const backRotate = flip.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] });

  useEffect(() => {
    return () => {
      if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
    };
  }, []);

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
    <Pressable onPress={handleCardTap} disabled={!canFlip}>
      <View style={styles.flipContainer}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.border },
            styles.cardFace,
            { transform: [{ perspective: 1400 }, { rotateY: frontRotate }] },
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
          {/* Este hint vive en el frente, así que solo importa el caso "sin
              voltear" — cuando está volteada, el frente no es visible. */}
          {canFlip && (
            <Text style={[styles.flipHint, { color: colors.accent }]}>
              {isVideo ? 'Toca la carta para reproducir el video' : 'Toca la carta para ver la foto ↻'}
            </Text>
          )}
        </View>
        <MediaThumbnail
          uri={certificate.thumbnailUri}
          mediaType={certificate.metadata.mediaType}
          previewUri={certificate.previewImageUri}
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
        </Animated.View>

        {/* Reverso de la carta: la foto o el VIDEO real (con reproducción
            de verdad, no solo el frame) a tamaño completo. Solo existe si
            hay archivo local que mostrar (canFlip) — si no, la carta ni
            siquiera responde al toque. pointerEvents normal (no 'none')
            para video: así los controles nativos del reproductor
            (play/pausa/barra) son tocables; tocar el video fuera de esos
            controles sigue volteando la carta de vuelta, gracias al
            Pressable que envuelve todo. */}
        {canFlip && (
          <Animated.View
            style={[
              styles.card,
              styles.cardFace,
              styles.cardBack,
              { backgroundColor: colors.background, borderColor: colors.border },
              { transform: [{ perspective: 1400 }, { rotateY: backRotate }] },
            ]}
          >
            {isVideo ? (
              <VideoBackFace uri={certificate.thumbnailUri!} active={flipped} />
            ) : (
              <>
                <Image source={{ uri: certificate.thumbnailUri }} style={styles.cardBackImage} resizeMode="cover" />
                <Text style={styles.cardBackLabel}>CERTIFICADO VERITY — FOTO ORIGINAL</Text>
              </>
            )}
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Reproductor de video real para el reverso de la carta (no un frame
 * estático). `active` refleja si la carta está actualmente volteada hacia
 * este lado — se usa para pausar automáticamente el video en cuanto deja
 * de estar visible (al voltear de vuelta o al cerrar el detalle), en vez
 * de dejarlo sonando de fondo.
 */
function VideoBackFace({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (active) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // el player puede ya estar liberado al desmontar — ignorar
      }
    };
  }, [player]);

  return (
    <VideoView player={player} style={styles.cardBackImage} nativeControls contentFit="cover" />
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
  // Carta "volteable": el frente vive en el flujo normal (define el alto
  // del contenedor), el reverso se superpone exactamente encima con
  // position:absolute + inset 0. backfaceVisibility:'hidden' es lo que
  // hace que cada cara desaparezca al pasar de los 90°, sin necesidad de
  // controlar la opacidad a mano.
  flipContainer: { position: 'relative' },
  cardFace: { backfaceVisibility: 'hidden' },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  cardBackImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardBackLabel: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 4,
  },
  flipHint: { fontSize: 10.5, fontWeight: '700', marginTop: 4 },
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
