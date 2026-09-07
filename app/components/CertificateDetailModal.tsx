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
  Easing,
  Dimensions,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEventListener } from 'expo';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import MediaThumbnail from './MediaThumbnail';
import SealMedallion from './SealMedallion';
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
                <ScrollView contentContainerStyle={styles.documentScrollContent}>
                  <CertificateDocument certificate={item} />
                </ScrollView>
              </View>
            )}
          />
        ) : (
          certificate && (
            <ScrollView contentContainerStyle={styles.documentScrollContent}>
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
  // para las miniaturas chicas de lista/grilla).
  //
  // La carta SIEMPRE se puede voltear, incluso sin archivo local (ej. un
  // certificado restaurado desde backup) — en ese caso el reverso
  // muestra la estampilla de nivel de confianza en vez de "no hay nada
  // que ver". La idea es que importar un historial viejo se sienta
  // "estos sellos siguen siendo válidos", no "esto se rompió".
  const hasLocalMedia = !!certificate.thumbnailUri;
  const canFlip = true;

  const [flipped, setFlipped] = useState(false);
  // Espejo en un ref del mismo valor que `flipped`. Es LA causa del bug
  // "el giro no para nunca": el auto-retorno programaba
  // `setTimeout(handleCardTap, 2200)`, pero esa llamada recursiva
  // referenciaba la función `handleCardTap` de ESE render (con `flipped`
  // congelado en su valor de ese momento vía closure) — cuando el
  // timeout disparaba, `goingToBack = !flipped` se recalculaba con ese
  // valor viejo, así que creía que tenía que girar hacia el reverso otra
  // vez (aunque ya estaba ahí), programaba OTRO retorno, y así para
  // siempre. Leer `flippedRef.current` en vez de `flipped` evita el
  // problema por completo: un ref siempre da el valor más reciente, sin
  // importar qué closure lo esté leyendo.
  const flippedRef = useRef(false);
  function updateFlipped(value: boolean) {
    flippedRef.current = value;
    setFlipped(value);
  }

  // Un solo valor de 0 a 1 maneja TODO el giro de moneda (ver el mockup
  // del usuario: coinFlip 0.7s — rotateY 0→180→360, translateY 0→-50→0,
  // scale 1→1.1→1). A diferencia del "flip de carta" clásico (dos caras
  // superpuestas con backfaceVisibility), aquí es UNA sola vista cuyo
  // contenido se intercambia justo en la mitad del giro (con la carta de
  // canto y casi invisible por la perspectiva) — por eso el giro
  // completa 360° y no 180°: para volver a quedar de frente al usuario
  // mostrando el contenido nuevo.
  const spin = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const flipBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SPIN_DURATION_MS = 700;
  const AUTO_RETURN_MS = 2200;

  // Cuánto falta del auto-retorno cuando se pausa (mantener el dedo
  // presionado sobre la foto/sello, como en Instagram Stories) y en qué
  // momento se reanudó por última vez — con esto se puede calcular
  // cuánto tiempo REAL queda, en vez de reiniciar la cuenta desde cero
  // cada vez que se suelta.
  const autoReturnRemainingMs = useRef(AUTO_RETURN_MS);
  const autoReturnStartedAt = useRef<number | null>(null);

  function scheduleAutoReturn(ms: number) {
    autoReturnRemainingMs.current = ms;
    autoReturnStartedAt.current = Date.now();
    flipBackTimer.current = setTimeout(handleCardTap, ms);
  }

  /** Mantener el dedo presionado sobre la foto/sello congela el
   * auto-retorno — no aplica a video (ese ya no tiene auto-retorno, se
   * controla con play/pausa real). */
  function pauseAutoReturn() {
    if (isVideo || !flipBackTimer.current || autoReturnStartedAt.current === null) return;
    clearTimeout(flipBackTimer.current);
    flipBackTimer.current = null;
    const elapsed = Date.now() - autoReturnStartedAt.current;
    // Mínimo 400ms al soltar, para que nunca se sienta "instantáneo".
    autoReturnRemainingMs.current = Math.max(400, autoReturnRemainingMs.current - elapsed);
    autoReturnStartedAt.current = null;
  }

  function resumeAutoReturn() {
    if (isVideo || !flippedRef.current || flipBackTimer.current) return;
    scheduleAutoReturn(autoReturnRemainingMs.current);
  }

  /**
   * Dispara UN giro de moneda (una sola vez, nunca en bucle). Para FOTO
   * (o el sello, cuando no hay archivo local), además vuelve sola al
   * frente a los ~2.2s (un vistazo rápido) — mantener el dedo
   * presionado sobre la imagen pausa esa cuenta (ver pauseAutoReturn).
   * Para VIDEO no hay auto-retorno: el video se queda reproduciendo —
   * volver es una acción explícita del usuario (botón "Volver al
   * certificado").
   */
  function handleCardTap() {
    if (!canFlip || isAnimating.current) return;
    if (flipBackTimer.current) {
      clearTimeout(flipBackTimer.current);
      flipBackTimer.current = null;
    }
    isAnimating.current = true;
    const goingToBack = !flippedRef.current;
    spin.setValue(0);
    // El contenido se intercambia a la mitad del giro (de canto, casi
    // invisible por la perspectiva), no al terminar — así lo que
    // "aterriza" en la segunda mitad del giro ya es el contenido nuevo.
    swapTimer.current = setTimeout(() => updateFlipped(goingToBack), SPIN_DURATION_MS / 2);
    Animated.timing(spin, {
      toValue: 1,
      duration: SPIN_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false;
      if (goingToBack && !isVideo) {
        scheduleAutoReturn(AUTO_RETURN_MS);
      }
    });
  }

  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const translateY = spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -50, 0] });
  const scale = spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] });

  useEffect(() => {
    return () => {
      if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
      if (swapTimer.current) clearTimeout(swapTimer.current);
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

  /**
   * "Sello #A00001" es un número REAL de orden: el 1º, 2º, 3º...
   * archivo que sellaste en ESTE teléfono (foto o video, cámara o
   * galería, una sola secuencia — ver getNextSequenceNumber en
   * cryptoUtils.ts). Antes era un dato decorativo inventado sin
   * ninguna utilidad; ahora sirve de verdad para nombrar/ordenar tus
   * propios archivos o documentos.
   */
  /**
   * Explica los 3 niveles DE UNA VEZ (no solo "Baja") — el punto clave
   * a dejar clarísimo: esto NO evalúa si el contenido es real o falso,
   * solo qué tanta información de origen hay disponible.
   */
  function handleTrustInfo() {
    Alert.alert(
      '¿Qué significa el nivel de confianza?',
      'No dice si tu foto o video es real o falso — dice qué tanta información tenemos sobre CÓMO se tomó.\n\n' +
        '• Alta: se tomó con la cámara de Verity, con ubicación y hora confirmadas.\n' +
        '• Media: viene de tu galería, pero trae información de fecha (o es un video).\n' +
        '• Baja: no hay información extra disponible (común en fotos de galería sin esos datos, por ejemplo si te las mandaron por WhatsApp).\n\n' +
        'En los 3 casos el sello es igual de válido — la diferencia es solo cuánta evidencia extra tenemos sobre el origen.'
    );
  }

  function handleRefInfo() {
    Alert.alert(
      '¿Qué es este número?',
      'Es el número de orden en que sellaste este archivo en tu teléfono (ej. tu sello #1, #2, #3...) — te sirve para nombrar u ordenar tus propios archivos. No es el número de sello para verificar: para eso usa el "Número de sello completo" de más abajo.'
    );
  }

  // Una vez volteada (a lo que sea: video, foto o el sello), tocar la
  // carta ya NO la regresa de inmediato — antes eso hacía que mantener
  // el dedo presionado para pausar la foto también contara como "toque"
  // y la volteara de golpe al soltar. Volver es siempre una acción
  // explícita (botón "Volver al certificado") o el auto-retorno normal
  // (foto/sello, pausable con el dedo — ver pauseAutoReturn).
  const cardTapDisabled = !canFlip || flipped;

  return (
    <Pressable onPress={handleCardTap} disabled={cardTapDisabled}>
      <Animated.View
        style={[
          styles.card,
          !flipped && styles.cardFront,
          { backgroundColor: colors.background, borderColor: colors.border },
          { transform: [{ perspective: 1000 }, { translateY }, { scale }, { rotateY }] },
        ]}
      >
        {!flipped ? (
          <>
            {/* Encabezado: insignia + título + referencia, foto a la derecha */}
            <View style={styles.header}>
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Ionicons name="shield-checkmark" size={28} color={colors.accentText} />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: colors.text }]}>CERTIFICADO VERITY</Text>
                <Pressable onPress={handleRefInfo} hitSlop={6} style={styles.refRow}>
                  <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                    Sello {formatSequenceRef(certificate)} · Polygon Amoy
                  </Text>
                  <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
                </Pressable>
                <Text style={[styles.flipHint, { color: colors.accent }]}>
                  {hasLocalMedia
                    ? isVideo
                      ? 'Toca la carta para reproducir el video'
                      : 'Toca la carta para ver la foto ↻'
                    : 'Toca la carta para ver el sello ↻'}
                </Text>
              </View>
              <MediaThumbnail
                uri={certificate.thumbnailUri}
                mediaType={certificate.metadata.mediaType}
                previewUri={certificate.previewImageUri}
                trustLevel={certificate.trustLevel}
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

            {/* Estado final: nivel de confianza. IMPORTANTE dejar claro qué
                significa (y qué NO significa) — un usuario que sube una
                foto real, tomada por él mismo, desde la galería, va a ver
                "CONFIANZA BAJA" (falta GPS/hora verificables) y podría
                pensar que la app está diciendo que su foto es falsa o una
                estafa. Antes había un párrafo largo siempre visible debajo
                de la insignia (se veía poco profesional, en especial
                repetido en cada certificado) — ahora toda la insignia es
                tocable y explica los 3 niveles de una vez, en un solo
                lugar, sin ocupar espacio permanente en la tarjeta. */}
            <TrustPill level={certificate.trustLevel} onPress={handleTrustInfo} />

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
          </>
        ) : (
          // Reverso: la foto, el VIDEO real (con reproducción de verdad,
          // no solo el frame), o — sin archivo local (ej. certificado
          // restaurado desde backup) — el sello de nivel de confianza +
          // un mensaje corto que tranquiliza: el sello sigue siendo
          // válido, solo no hay archivo guardado en ESTE teléfono.
          <View style={styles.cardBack}>
            {isVideo && hasLocalMedia ? (
              <>
                <VideoBackFace
                  uri={certificate.thumbnailUri!}
                  active={flipped}
                  onPlaybackEnded={handleCardTap}
                />
                {/* Acción explícita para volver — separada de tocar el
                    video (que ahora solo controla play/pausa). */}
                <Pressable style={styles.backToCardButton} onPress={handleCardTap} hitSlop={8}>
                  <Ionicons name="arrow-back" size={16} color="#fff" />
                  <Text style={styles.backToCardText}>Volver al certificado</Text>
                </Pressable>
              </>
            ) : hasLocalMedia ? (
              <>
                {/* onPressIn/onPressOut (no onPress) para no chocar con
                    el toque normal: mantener el dedo presionado pausa
                    el auto-retorno (estilo Instagram Stories), soltar
                    lo reanuda con el tiempo que faltaba — así hay
                    tiempo de sobra para leer/mirar antes de que la
                    carta vuelva sola. delayLongPress alto evita que un
                    toque rápido normal dispare esto por accidente. */}
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPressIn={pauseAutoReturn}
                  onPressOut={resumeAutoReturn}
                >
                  <Image source={{ uri: certificate.thumbnailUri }} style={styles.cardBackImage} resizeMode="cover" />
                  <Text style={styles.cardBackLabel}>CERTIFICADO VERITY — FOTO ORIGINAL</Text>
                </Pressable>
                <Pressable style={styles.backToCardButton} onPress={handleCardTap} hitSlop={8}>
                  <Ionicons name="arrow-back" size={16} color="#fff" />
                  <Text style={styles.backToCardText}>Volver al certificado</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.cardBackNoMedia}>
                <SealMedallion trustLevel={certificate.trustLevel} size={190} />
                <Text style={[styles.cardBackNoMediaText, { color: colors.textMuted }]}>
                  Este {mediaLabel} no está guardado en este teléfono (el certificado se restauró desde una
                  copia de seguridad, que nunca incluye archivos), pero el sello sigue siendo 100% válido —
                  anclado en Polygon Amoy con el número de sello de arriba.
                </Text>
                <Pressable
                  style={[styles.backToCardButtonDark, { borderColor: colors.accent }]}
                  onPress={handleCardTap}
                  hitSlop={8}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.accent} />
                  <Text style={[styles.backToCardTextDark, { color: colors.accent }]}>Volver al certificado</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Reproductor de video real para el reverso de la carta (no un frame
 * estático). `active` refleja si la carta está actualmente volteada hacia
 * este lado — se usa para pausar automáticamente el video en cuanto deja
 * de estar visible (al voltear de vuelta o al cerrar el detalle), en vez
 * de dejarlo sonando de fondo.
 *
 * `loop = false` a propósito: el video reproduce una vez y se queda en
 * pausa en el último frame al terminar — los controles nativos ya
 * muestran un botón de "reproducir de nuevo" en ese estado.
 *
 * `onPlaybackEnded` se llama 3 segundos después de que el video termina
 * (para que el último frame se alcance a ver, no un corte seco), y
 * dispara el giro de vuelta al certificado. Si el usuario le da "play"
 * de nuevo (reproducir otra vez) ANTES de que pasen esos 3 segundos,
 * la espera se cancela — solo vuelve sola cuando el video se queda
 * quieto en pausa, nunca interrumpiendo una reproducción en curso.
 */
function VideoBackFace({
  uri,
  active,
  onPlaybackEnded,
}: {
  uri: string;
  active: boolean;
  onPlaybackEnded: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearEndTimer() {
    if (endTimer.current) {
      clearTimeout(endTimer.current);
      endTimer.current = null;
    }
  }

  useEventListener(player, 'playToEnd', () => {
    clearEndTimer();
    endTimer.current = setTimeout(onPlaybackEnded, 3000);
  });

  // Si el usuario le da "play" de nuevo (reproducir otra vez tras
  // terminar) antes de que se cumplan los 3 segundos, se cancela el
  // retorno automático — no debe volver sola a mitad de una repetición.
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) clearEndTimer();
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
      clearEndTimer();
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

/**
 * Número de orden real (ver VerityCertificate.sequenceNumber). Los
 * certificados creados antes de que existiera este campo no lo tienen
 * — para esos, en vez de mentir con un "#1" que no es cierto, se cae a
 * los primeros caracteres del número de sello (sigue siendo único y
 * estable, solo que no es secuencial).
 */
function formatSequenceRef(certificate: VerityCertificate): string {
  if (certificate.sequenceNumber) {
    return `#A${String(certificate.sequenceNumber).padStart(5, '0')}`;
  }
  const clean = certificate.anchor.txHash.startsWith('0x')
    ? certificate.anchor.txHash.slice(2)
    : certificate.anchor.txHash;
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

function TrustPill({ level, onPress }: { level: VerityCertificate['trustLevel']; onPress: () => void }) {
  const { colors } = useTheme();
  const color = level === 'ALTO' ? colors.success : level === 'MEDIO' ? colors.warning : colors.tabBarInactive;
  const label = level === 'ALTO' ? 'CONFIANZA ALTA' : level === 'MEDIO' ? 'CONFIANZA MEDIA' : 'CONFIANZA BAJA';
  return (
    <Pressable onPress={onPress} style={[styles.pill, { borderColor: color }]} hitSlop={4}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
      <Ionicons name="information-circle-outline" size={15} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  // flexGrow:1 + justifyContent:'center' es el patrón estándar para
  // "centrar contenido corto, pero seguir permitiendo scroll si el
  // contenido es más alto que la pantalla": el frente del certificado
  // (con todos los campos) normalmente es más alto que la pantalla, así
  // que se comporta como scroll normal desde arriba; el reverso
  // (foto/video/sello) es mucho más corto, y antes quedaba pegado
  // arriba con un montón de espacio vacío debajo — ahora queda
  // centrado verticalmente en la pantalla.
  documentScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: 4 },
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
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  // El frente necesita el padding normal de una tarjeta; el reverso
  // (foto/video a pantalla completa) lo pierde a propósito para poder
  // llegar hasta el borde — se aplica por separado en el JSX según
  // `flipped`, no como parte fija de `card`.
  cardFront: { padding: 20 },
  cardBack: {
    minHeight: 420,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBackImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backToCardButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backToCardText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  // Misma acción, pero como botón normal en el flujo (no flotando sobre
  // una imagen) — el sello no tiene nada debajo para "flotar" encima.
  backToCardButtonDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  backToCardTextDark: { fontSize: 12, fontWeight: '700' },
  cardBackNoMedia: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  cardBackNoMediaText: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
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
  // Mismo tamaño que .photo (56x56) a propósito: antes el escudo (40x40)
  // y la miniatura de la derecha (56x56) no coincidían, así que el
  // renglón se veía disparejo — ninguno de los dos quedaba alineado
  // limpiamente con la altura del bloque de texto del medio.
  badge: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { fontSize: 12, marginTop: 2 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  photo: { width: 56, height: 56, borderRadius: 10, borderWidth: 1 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  dashedDivider: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 18 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  dataLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, maxWidth: '45%' },
  dataValue: { fontSize: 13, fontFamily: 'monospace', fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  sectionLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, marginTop: 20, marginBottom: 10 },
  evidenceLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  evidenceText: { fontSize: 13, flex: 1 },
  // flexDirection:'row' para que quepa el ícono de info junto al texto
  // — toda la insignia es tocable y explica los 3 niveles (ver
  // handleTrustInfo), en vez del párrafo largo que había antes siempre
  // visible debajo.
  pill: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 12,
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
