/**
 * CaptureScreen.tsx
 * ---------------------------------------------------------------------------
 * Pantalla principal de "Sellar". Flujo (sin jerga técnica para el usuario):
 *
 *   1. Elegir foto (cámara de la app o galería)
 *   2. Si viene de la cámara, se guarda también en la galería del
 *      dispositivo (así queda disponible después para probarla en "Verificar")
 *   3. Calcular su "huella digital" en el propio teléfono (hashService)
 *   4. Registrarla en el "registro público" (blockchainService → Polygon Amoy)
 *   5. Mostrar el certificado con su nivel de confianza
 *
 * El archivo original NUNCA se sube a ningún servidor — ver hashService.ts.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
// SafeAreaView de 'react-native' está deprecado; se usa el de
// react-native-safe-area-context (requiere <SafeAreaProvider> en App.tsx).
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import Ionicons from '@expo/vector-icons/Ionicons';

import { hashFile } from '../services/hashService';
import { anchorHashOnChain } from '../services/blockchainService';
import CameraButton from '../components/CameraButton';
import CertificateCard from '../components/CertificateCard';
import CertificateDetailModal from '../components/CertificateDetailModal';
import StampReveal from '../components/StampReveal';
import SealStamp from '../components/SealStamp';
import SettingsButton from '../components/SettingsButton';
import CoachMark from '../components/CoachMark';
import PaywallModal from '../components/PaywallModal';
import { useTheme } from '../theme/ThemeContext';
import { getSealUsage, canSealThisMonth, type SealUsage } from '../services/revenuecatService';
import { submitToPublicIndex } from '../services/verificationIndexService';
import type {
  CaptureMetadata,
  TrustLevel,
  VerityCertificate,
} from '../../documentation/technical/verity-protocol';
import { saveCertificate, findCertificateByHash, getNextSequenceNumber } from '../utils/cryptoUtils';
import { hasSeenCoachMark, markCoachMarkSeen, useCoachMarkResetVersion } from '../utils/coachMarkUtils';

type CaptureStep = 'idle' | 'hashing' | 'anchoring' | 'done' | 'error';

/** Tope técnico del lote (solo PRO — ver handleGalleryPick). No es un
 * número que el usuario tenga que conocer o elegir: es una protección
 * de sentido común (cada archivo es su propia transacción en Polygon,
 * uno detrás de otro) para que un lote no tarde una eternidad, no un
 * límite de producto. */
const MAX_BATCH_SIZE = 50;

interface BatchState {
  total: number;
  processed: number;
  sealedCount: number;
  duplicateCount: number;
  failedCount: number;
  currentLabel: string;
  done: boolean;
  limitReachedMidBatch: boolean;
}

export default function CaptureScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState<CaptureStep>('idle');
  const [certificate, setCertificate] = useState<VerityCertificate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  // Freemium (RevenueCat) — ver revenuecatService.ts. `usage` alimenta
  // tanto el indicador de la pantalla inicial ("3/10 este mes") como el
  // propio paywall (para mostrar "ya usaste tus 10").
  const [usage, setUsage] = useState<SealUsage | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  // Lote múltiple (solo PRO — ver handleGalleryPick). No null mientras
  // se está procesando o mostrando el resumen de un lote; toma el
  // lugar de la UI normal de `step` mientras tanto.
  const [batch, setBatch] = useState<BatchState | null>(null);

  async function refreshUsage(): Promise<SealUsage> {
    const u = await getSealUsage();
    setUsage(u);
    return u;
  }

  useEffect(() => {
    refreshUsage();
  }, []);

  /** Se llama al INICIO de cualquier acción que vaya a sellar algo. Si
   * ya se llegó al límite gratis del mes, muestra el paywall en vez de
   * dejar continuar — así el límite es real, no decorativo. */
  async function ensureCanSeal(): Promise<boolean> {
    const u = await refreshUsage();
    if (u.limitReached) {
      setPaywallVisible(true);
      return false;
    }
    return true;
  }

  // Recorrido guiado (una sola vez, la primera vez que se entra a esta
  // pestaña — ver coachMarkUtils.ts). `collapsable={false}` en el View
  // que envuelve el botón es necesario en Android para poder medirlo.
  const [showTour, setShowTour] = useState(false);
  const primaryButtonRef = useRef<View>(null);
  const secondaryRowRef = useRef<View>(null);
  const howCardRef = useRef<View>(null);
  const coachResetVersion = useCoachMarkResetVersion();
  useEffect(() => {
    hasSeenCoachMark('capture').then((seen) => setShowTour(!seen));
  }, [coachResetVersion]);

  /**
   * Calcula el nivel de confianza según el origen del archivo y sus metadatos.
   *
   * Nota sobre videos de galería: `DateTimeOriginal` es un tag EXIF que solo
   * existe en fotos — expo-image-picker no expone ninguna fecha de captura
   * verificable para videos elegidos de la galería (ver ImagePickerAsset:
   * no hay `creationTime`, solo `duration`). Con la regla original, eso
   * hacía que TODO video de galería cayera siempre a BAJO sin importar el
   * archivo, porque `capturedAt` nunca podía llenarse. Se trata como MEDIO
   * (mismo nivel que una foto de galería con EXIF real) en vez de exigirle
   * a los videos un dato que la plataforma no entrega.
   */
  function computeTrustLevel(metadata: CaptureMetadata): TrustLevel {
    if (metadata.source === 'camera' && metadata.latitude && metadata.capturedAt) {
      return 'ALTO';
    }
    if (metadata.capturedAt) {
      return 'MEDIO';
    }
    if (metadata.source === 'gallery' && metadata.mediaType === 'video') {
      return 'MEDIO';
    }
    return 'BAJO';
  }

  /**
   * Copia una foto tomada con la cámara de la app a una carpeta propia y
   * permanente de Verity (fuera de la caché temporal que usa la cámara).
   *
   * Nota: se evaluó guardarla directamente en la galería del sistema con
   * expo-media-library, pero su API actual (SDK 57) requiere un
   * "development build" nativo propio — no funciona dentro de Expo Go,
   * que es como se prueba este MVP. Por eso se usa almacenamiento propio
   * de la app (funciona en Expo Go sin builds nativas) + la pestaña
   * "Verificar" ofrece elegir directamente de "Mis sellos" para cerrar
   * el ciclo sin depender de la galería del sistema.
   */
  async function saveCapturePermanently(uri: string, fileName: string): Promise<string> {
    try {
      const capturesDir = new Directory(Paths.document, 'verity-captures');
      if (!capturesDir.exists) {
        capturesDir.create({ intermediates: true });
      }

      const destination = new File(capturesDir, fileName);
      // Antes se usaba source.copy(destination) (File.copy() de la API
      // nueva de expo-file-system), pero falla con "Missing READ
      // permission" para algunas URIs content:// que devuelve la cámara
      // nativa al grabar video (ej. en MIUI) — la app SÍ puede leer esa
      // URI (el hasheo y la generación del frame de video funcionan bien
      // con ella), solo File.copy() específicamente la rechaza. fetch()
      // sí puede leerla sin problema (mismo truco ya usado para leer el
      // backup elegido con DocumentPicker), así que se lee el contenido
      // completo y se escribe a mano en vez de depender de copy().
      const response = await fetch(uri);
      const buffer = await response.arrayBuffer();
      if (!destination.exists) destination.create({ intermediates: true });
      destination.write(new Uint8Array(buffer));
      return destination.uri;
    } catch (error) {
      console.warn('No se pudo guardar la copia permanente del archivo:', error);
      return uri;
    }
  }

  /**
   * El trabajo real de sellar UN archivo (hash → detectar duplicado →
   * guardar copia → anclar → guardar certificado), sin tocar ningún
   * estado de UI de la pantalla — así lo puede usar tanto el flujo de
   * un solo archivo (processAsset, abajo) como el lote múltiple
   * (processBatch), cada uno decidiendo cómo mostrar el progreso.
   * `onStep` es opcional porque el lote no necesita (ni quiere) mostrar
   * "Calculando huella..." / "Registrando..." por cada ítem — solo su
   * barra de progreso general.
   */
  async function sealAsset(
    asset: ImagePicker.ImagePickerAsset,
    source: 'camera' | 'gallery',
    onStep?: (step: 'hashing' | 'anchoring') => void
  ): Promise<{ certificate: VerityCertificate; duplicate: boolean }> {
      onStep?.('hashing');

      // Metadatos disponibles. GPS solo se intenta pedir cuando la captura
      // viene de la cámara de la app (nivel ALTO), para no pedir permisos
      // de ubicación innecesarios si el usuario solo sube algo de galería.
      //
      // IMPORTANTE: capturedAt solo se llena con una fecha real:
      // - Si viene de la cámara de la app, la hora del dispositivo AHORA
      //   MISMO es un dato real y verificable (se acaba de tomar la foto).
      // - Si viene de galería, solo cuenta si el archivo trae EXIF con
      //   fecha de captura real. Antes esto tenía un valor de respaldo
      //   (new Date()) para AMBOS casos, lo que hacía que un archivo sin
      //   ningún metadato terminara igual con "capturedAt" relleno y
      //   nunca calificara como BAJO — quedaba siempre en MEDIO.
      const metadata: CaptureMetadata = {
        source,
        capturedAt:
          source === 'camera' ? new Date().toISOString() : asset.exif?.DateTimeOriginal,
      };

      if (source === 'camera') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({});
          metadata.latitude = position.coords.latitude;
          metadata.longitude = position.coords.longitude;
        }
      }

      // Verity sella tanto fotos como videos. `asset.type` viene del
      // picker; si por algún motivo no llega, se infiere por la
      // extensión del archivo como respaldo.
      metadata.mediaType = asset.type === 'video' ? 'video' : 'image';

      const certificateId = randomUUID();

      // 1) Huella digital, calculada 100% en el dispositivo (sobre el
      // archivo original, antes de moverlo a ningún lado).
      const hashResult = await hashFile(asset.uri);

      // 1.5) ¿Ya se selló este mismo archivo antes? Si sí, mostramos el
      // certificado existente en vez de anclar (y pagar gas) de nuevo —
      // evita terminar con dos certificados distintos para la misma foto
      // sin saberlo.
      const existing = await findCertificateByHash(hashResult.sha256);
      if (existing) {
        return { certificate: existing, duplicate: true };
      }

      // 2) Si viene de la cámara, copiarla a una carpeta propia y
      // permanente de la app (la caché de la cámara se puede borrar en
      // cualquier momento). Si viene de galería, ya vive en un lugar
      // persistente del sistema.
      // La extensión NO puede quedar fija en .jpg: ahora también se
      // sellan videos (.mp4 típicamente). Se toma del archivo original;
      // si no se puede determinar, se usa un respaldo según el tipo.
      const extension = getFileExtension(asset.uri) ?? (metadata.mediaType === 'video' ? 'mp4' : 'jpg');
      const persistentUri =
        source === 'camera'
          ? await saveCapturePermanently(asset.uri, `${certificateId}.${extension}`)
          : asset.uri;

      // 2.5) Si es un video, generar un frame real como vista previa (una
      // <Image> no puede decodificar video, así que sin esto solo se
      // podría mostrar un ícono genérico). No es crítico: si falla, el
      // sellado sigue su curso igual.
      const previewImageUri =
        metadata.mediaType === 'video' ? await generateVideoPreview(persistentUri, certificateId) : undefined;

      // 3) Registro en el "registro público" (Polygon Amoy testnet).
      onStep?.('anchoring');
      const anchor = await anchorHashOnChain(hashResult.sha256);

      // 4) Armar el certificado y guardarlo en el historial local.
      const sequenceNumber = await getNextSequenceNumber();
      const newCertificate: VerityCertificate = {
        id: certificateId,
        sha256: hashResult.sha256,
        trustLevel: computeTrustLevel(metadata),
        metadata,
        anchor,
        thumbnailUri: persistentUri,
        previewImageUri,
        sequenceNumber,
      };

      await saveCertificate(newCertificate);
      // Fire-and-forget a propósito (ver verificationIndexService.ts): el
      // sello ya quedó anclado en Polygon pase lo que pase con esto, así
      // que nunca debe bloquear ni fallar el sellado en sí.
      submitToPublicIndex(newCertificate);
      return { certificate: newCertificate, duplicate: false };
  }

  /** Punto de entrada de UN solo archivo (cámara, o galería sin lote):
   * llama a sealAsset y traduce el resultado a los estados de pantalla
   * (step/certificate/error) de esta pantalla. */
  async function processAsset(
    asset: ImagePicker.ImagePickerAsset,
    source: 'camera' | 'gallery'
  ) {
    try {
      setErrorMessage(null);
      setCertificate(null);
      setIsDuplicate(false);
      setStep('hashing');

      const { certificate: result, duplicate } = await sealAsset(asset, source, setStep);
      if (!duplicate) refreshUsage();

      setCertificate(result);
      setIsDuplicate(duplicate);
      setStep('done');
    } catch (error) {
      console.error('Error al sellar el archivo:', error);
      // Los errores que lanzamos nosotros mismos (ej. archivo demasiado
      // pesado) ya vienen en un texto pensado para el usuario -- se
      // muestran tal cual en vez del mensaje genérico de conexión.
      const message =
        error instanceof Error && error.message.includes('demasiado pesado')
          ? error.message
          : 'No pudimos completar el sello. Revisa tu conexión e inténtalo de nuevo.';
      setErrorMessage(message);
      setStep('error');
    }
  }

  /**
   * Sella varios archivos elegidos de golpe en la galería (solo PRO —
   * ver handleGalleryPick). Se procesan UNO POR UNO, nunca en paralelo:
   * cada sello es su propia transacción en Polygon, y mandarlas todas
   * a la vez arriesgaría un choque de nonce en la wallet del
   * dispositivo. La UI no bloquea con una confirmación por archivo —
   * solo una barra de progreso general — para que el usuario no tenga
   * que quedarse mirando cada uno.
   */
  async function processBatch(assets: ImagePicker.ImagePickerAsset[]) {
    setErrorMessage(null);
    setCertificate(null);
    setIsDuplicate(false);
    setBatch({
      total: assets.length,
      processed: 0,
      sealedCount: 0,
      duplicateCount: 0,
      failedCount: 0,
      currentLabel: '',
      done: false,
      limitReachedMidBatch: false,
    });

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const label =
        asset.type === 'video'
          ? `Sellando video ${i + 1} de ${assets.length}...`
          : `Sellando foto ${i + 1} de ${assets.length}...`;
      setBatch((prev) => (prev ? { ...prev, currentLabel: label } : prev));

      // El lote es una función PRO (ilimitado), pero esto queda como
      // protección real por si algún día cambia esa regla: si a mitad
      // de camino se agota el cupo del mes, se detiene acá y avisa con
      // el paywall en vez de seguir anclando de más.
      if (!(await canSealThisMonth())) {
        setBatch((prev) => (prev ? { ...prev, done: true, limitReachedMidBatch: true } : prev));
        refreshUsage();
        setPaywallVisible(true);
        return;
      }

      try {
        const { duplicate } = await sealAsset(asset, 'gallery');
        setBatch((prev) =>
          prev
            ? {
                ...prev,
                processed: prev.processed + 1,
                sealedCount: prev.sealedCount + (duplicate ? 0 : 1),
                duplicateCount: prev.duplicateCount + (duplicate ? 1 : 0),
              }
            : prev
        );
      } catch (error) {
        console.error('Error al sellar en lote:', error);
        setBatch((prev) => (prev ? { ...prev, processed: prev.processed + 1, failedCount: prev.failedCount + 1 } : prev));
      }
    }

    refreshUsage();
    setBatch((prev) => (prev ? { ...prev, done: true } : prev));
  }

  /** Extrae la extensión de un archivo a partir de su URI (sin el punto), o null si no se puede determinar. */
  function getFileExtension(uri: string): string | null {
    const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Extrae un frame fijo de un video (al segundo 1) para usarlo como
   * miniatura real en el historial, en vez de mostrar siempre el mismo
   * ícono genérico de cámara. Se copia a la carpeta permanente de Verity
   * (el archivo que genera expo-video-thumbnails vive en caché temporal).
   * Si algo falla (formato no soportado, video muy corto, etc.), se
   * devuelve undefined y MediaThumbnail cae de vuelta al ícono genérico —
   * nunca debe tumbar el sellado completo por esto.
   */
  async function generateVideoPreview(videoUri: string, certificateId: string): Promise<string | undefined> {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000 });
      return await saveCapturePermanently(uri, `${certificateId}-preview.jpg`);
    } catch (error) {
      console.warn('No se pudo generar la vista previa del video:', error);
      return undefined;
    }
  }

  /**
   * `mode` fuerza qué abre la cámara nativa: antes se pedían fotos Y
   * videos a la vez (mediaTypes: ['images','videos']), lo que en la
   * práctica depende de que la app de cámara del teléfono ofrezca un
   * selector claro de modo o un "mantener presionado" para grabar — en
   * algunas cámaras (ej. MIUI) ese gesto se interpreta como ráfaga de
   * fotos en vez de video, y no hay forma de grabar. Pidiendo un solo
   * tipo (`['videos']` o `['images']`) la cámara nativa abre directo en
   * ese modo, sin ambigüedad de gesto.
   */
  async function handleCameraCapture(mode: 'photo' | 'video' = 'photo') {
    if (!(await ensureCanSeal())) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Verity necesita acceso a la cámara para sellar fotos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: mode === 'video' ? ['videos'] : ['images'],
      quality: 1,
      exif: true,
      ...(mode === 'video' ? { videoMaxDuration: 60 } : null),
    });

    if (!result.canceled && result.assets[0]) {
      await processAsset(result.assets[0], 'camera');
    }
  }

  /**
   * Elegir de galería. Selección múltiple es EXCLUSIVA de PRO: el plan
   * gratis sigue siendo una foto/video a la vez, como siempre — pedido
   * real del usuario ("una podría sellar una diaria" fue el
   * razonamiento del límite gratis, no pensado para lotes). No hace
   * falta un aviso aparte para el usuario gratis: el picker
   * simplemente no ofrece elegir varias, así que la experiencia es
   * idéntica a la de siempre.
   */
  async function handleGalleryPick() {
    if (!(await ensureCanSeal())) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Verity necesita acceso a tus fotos para sellarlas.');
      return;
    }

    const isPro = usage?.isPro ?? false;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
      exif: true,
      ...(isPro ? { allowsMultipleSelection: true, selectionLimit: MAX_BATCH_SIZE } : null),
    });

    if (result.canceled || !result.assets.length) return;

    if (result.assets.length > 1) {
      await processBatch(result.assets);
    } else {
      await processAsset(result.assets[0], 'gallery');
    }
  }

  /** Vuelve a la pantalla inicial para poder sellar otra foto. */
  function handleSealAnother() {
    setStep('idle');
    setCertificate(null);
    setErrorMessage(null);
    setIsDuplicate(false);
  }

  /** Cierra el resumen del lote y vuelve a la pantalla inicial. */
  function handleBatchFinish() {
    setBatch(null);
  }

  return (
    <>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Sellar contenido</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Crea una huella digital única de tu foto o video y regístrala en un
          registro público, sin subir el archivo a ningún lado.
        </Text>
        <SettingsButton />
      </View>

      {/* El estado completo del plan (gratis/PRO, X de 30 este mes) vive
          en Ajustes — fuente única de verdad, no se repite acá para no
          competir con la acción principal de esta pantalla ("Sellar"
          debe sentirse instantánea). Acá SOLO hay una tira, y es UNA
          sola a la vez (nunca dos apiladas): mientras quedan sellos de
          sobra es una invitación discreta y neutra a hazte PRO ("la
          parte de inicio se ve muy vacía" fue el feedback que la
          motivó); en cuanto quedan 7 o menos, la MISMA tira cambia a
          tono de aviso (color warning + texto de cuenta regresiva) —
          más urgente justo cuando importa, sin sumar una segunda caja. */}
      {usage && !usage.isPro && (
        <Pressable
          style={[
            styles.proStrip,
            usage.limit - usage.used <= 7
              ? { borderColor: colors.warning, backgroundColor: colors.background }
              : { borderColor: colors.border, backgroundColor: colors.background },
          ]}
          onPress={() => setPaywallVisible(true)}
        >
          <Ionicons
            name={usage.limit - usage.used <= 7 ? 'alert-circle-outline' : 'ribbon-outline'}
            size={14}
            color={usage.limit - usage.used <= 7 ? colors.warning : colors.accent}
          />
          <Text
            style={[
              styles.proStripText,
              { color: usage.limit - usage.used <= 7 ? colors.warning : colors.textMuted },
            ]}
          >
            {usage.limit - usage.used <= 7
              ? `Te quedan ${usage.limit - usage.used} sellos gratis este mes`
              : `Llevas ${usage.used} de ${usage.limit} sellos gratis · Hazte PRO para sellos ilimitados`}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={usage.limit - usage.used <= 7 ? colors.warning : colors.textMuted}
          />
        </Pressable>
      )}

      {/* Lote múltiple (PRO): toma el lugar de toda la UI de `step`
          mientras hay uno en curso o mostrando su resumen — no tiene
          sentido ver los botones de "Tomar foto" detrás de una barra
          de progreso de 12 archivos. */}
      {batch && (
        <View style={[styles.batchBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
          {!batch.done ? (
            <>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>{batch.currentLabel}</Text>
              <View style={[styles.batchProgressTrack, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <View
                  style={[
                    styles.batchProgressFill,
                    { width: `${Math.round((batch.processed / batch.total) * 100)}%`, backgroundColor: colors.accent },
                  ]}
                />
              </View>
              <Text style={[styles.batchProgressLabel, { color: colors.textMuted }]}>
                {batch.processed} de {batch.total}
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name={batch.limitReachedMidBatch ? 'alert-circle' : 'checkmark-circle'}
                size={40}
                color={batch.limitReachedMidBatch ? colors.warning : colors.success}
              />
              <Text style={[styles.batchSummaryTitle, { color: colors.text }]}>
                {batch.limitReachedMidBatch ? 'Llegaste a tu límite gratis a mitad de camino' : 'Lote sellado'}
              </Text>
              <Text style={[styles.batchSummaryText, { color: colors.textMuted }]}>
                {batch.sealedCount} sellados
                {batch.duplicateCount > 0 ? `, ${batch.duplicateCount} ya estaban sellados` : ''}
                {batch.failedCount > 0 ? `, ${batch.failedCount} fallaron` : ''} de {batch.total}.
              </Text>
              <Pressable style={[styles.sealAnotherButton, { borderColor: colors.accent }]} onPress={handleBatchFinish}>
                <Text style={[styles.sealAnotherText, { color: colors.accent }]}>Listo</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {!batch && (
        <>
          {step === 'idle' || step === 'error' ? (
            <>
              <View style={styles.actions}>
                <View ref={primaryButtonRef} collapsable={false}>
                  <CameraButton
                    onPress={() => handleCameraCapture('photo')}
                    label="Tomar foto"
                    icon="camera"
                  />
                </View>
                <View style={styles.secondaryRow} ref={secondaryRowRef} collapsable={false}>
                  <CameraButton
                    onPress={() => handleCameraCapture('video')}
                    label="Grabar video"
                    icon="videocam-outline"
                    secondary
                    style={styles.secondaryHalf}
                  />
                  <CameraButton
                    onPress={handleGalleryPick}
                    label="Galería"
                    icon="images-outline"
                    secondary
                    style={styles.secondaryHalf}
                  />
                </View>
                {usage?.isPro && (
                  <Text style={[styles.multiSelectHint, { color: colors.textMuted }]}>
                    Con PRO puedes elegir varias fotos o videos de golpe en Galería.
                  </Text>
                )}
              </View>

              <View
                ref={howCardRef}
                collapsable={false}
                style={[styles.howCard, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <Text style={[styles.howTitle, { color: colors.textMuted }]}>CÓMO FUNCIONA</Text>
                <HowStep
                  icon="finger-print-outline"
                  text="Se calcula una huella digital única de tu foto, dentro de tu teléfono."
                />
                <HowStep
                  icon="link-outline"
                  text="Esa huella se registra en Polygon, un registro público que nadie puede alterar."
                />
                <HowStep
                  icon="ribbon-outline"
                  text="Recibes un certificado con nivel de confianza, listo para compartir o verificar."
                  last
                />
              </View>
            </>
          ) : null}

          {(step === 'hashing' || step === 'anchoring') && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                {step === 'hashing'
                  ? 'Calculando huella digital...'
                  : 'Registrando en el registro público...'}
              </Text>
            </View>
          )}

          {step === 'error' && errorMessage && (
            <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
          )}

          {step === 'done' && certificate && (
            <>
              {isDuplicate && (
                <View style={[styles.duplicateBox, { borderColor: colors.warning, backgroundColor: colors.background }]}>
                  <Text style={[styles.duplicateText, { color: colors.warning }]}>
                    Ya habías sellado este archivo antes — aquí está tu certificado. No se
                    generó un sello nuevo ni se gastó gas de nuevo.
                  </Text>
                </View>
              )}
              <StampReveal trigger={certificate.id}>
                <View style={styles.stampedCardWrap}>
                  <CertificateCard certificate={certificate} onPress={() => setDetailVisible(true)} />
                  <SealStamp trigger={certificate.id} />
                </View>
              </StampReveal>
              <Pressable
                style={[styles.sealAnotherButton, { borderColor: colors.accent }]}
                onPress={handleSealAnother}
              >
                <Text style={[styles.sealAnotherText, { color: colors.accent }]}>Sellar otra foto</Text>
              </Pressable>
              <CertificateDetailModal
                certificate={certificate}
                visible={detailVisible}
                onClose={() => setDetailVisible(false)}
              />
            </>
          )}
        </>
      )}
    </SafeAreaView>

    {/* Hermano del SafeAreaView (no hijo) — ver nota en CoachMark.tsx
        sobre por qué esto es necesario para que el recuadro apunte al
        lugar correcto. */}
    <CoachMark
        visible={showTour && (step === 'idle' || step === 'error')}
        steps={[
          {
            targetRef: primaryButtonRef,
            title: 'Sella tu primera foto o video',
            text: 'Toca aquí para tomar una foto con la cámara de Verity — Verity calcula su huella digital y la registra en un registro público, sin subir el archivo a ningún lado.',
          },
          {
            targetRef: secondaryRowRef,
            title: 'También puedes grabar video o usar la galería',
            text: '"Grabar video" abre la cámara directo en modo video. "Galería" sella algo que ya tenías guardado en el teléfono.',
          },
          {
            targetRef: howCardRef,
            title: 'Así funciona, en 3 pasos',
            text: 'Huella digital → registro público → certificado con nivel de confianza. Nunca se sube tu foto ni tu video a ningún lado, solo su huella.',
          },
        ]}
        onFinish={() => {
          setShowTour(false);
          markCoachMarkSeen('capture');
        }}
      />

      <PaywallModal
        visible={paywallVisible}
        usage={usage}
        onClose={() => setPaywallVisible(false)}
        onPurchased={() => {
          setPaywallVisible(false);
          refreshUsage();
          Alert.alert('¡Listo!', 'Ya eres PRO — sellos ilimitados. Toca "Tomar foto" de nuevo para continuar.');
        }}
      />
    </>
  );
}

function HowStep({
  icon,
  text,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[howStepStyles.row, !last && howStepStyles.rowSpacing]}>
      <View style={[howStepStyles.iconCol, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <Text style={[howStepStyles.text, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const howStepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowSpacing: { marginBottom: 14 },
  iconCol: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontSize: 13, lineHeight: 19 },
});

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { position: 'relative', paddingRight: 48, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14 },
  proStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  proStripText: { flex: 1, fontSize: 12, fontWeight: '700' },
  multiSelectHint: { fontSize: 11.5, textAlign: 'center', marginTop: 2 },
  batchBox: {
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    padding: 24,
    borderWidth: 1,
    borderRadius: 20,
  },
  batchProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  batchProgressFill: { height: '100%', borderRadius: 999 },
  batchProgressLabel: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  batchSummaryTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  batchSummaryText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  actions: { gap: 12 },
  secondaryRow: { flexDirection: 'row', gap: 12 },
  secondaryHalf: { flex: 1 },
  stampedCardWrap: { position: 'relative', marginBottom: 12 },
  howCard: {
    marginTop: 24,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  howTitle: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, marginBottom: 14 },
  loadingBox: { alignItems: 'center', marginTop: 40, gap: 12 },
  loadingText: { fontSize: 14 },
  errorText: { marginTop: 16 },
  duplicateBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  duplicateText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sealAnotherButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  sealAnotherText: { fontWeight: '700' },
});
