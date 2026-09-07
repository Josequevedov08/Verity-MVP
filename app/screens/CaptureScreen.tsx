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
import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';

import { hashFile } from '../services/hashService';
import { anchorHashOnChain } from '../services/blockchainService';
import CameraButton from '../components/CameraButton';
import CertificateCard from '../components/CertificateCard';
import CertificateDetailModal from '../components/CertificateDetailModal';
import StampReveal from '../components/StampReveal';
import SettingsButton from '../components/SettingsButton';
import { useTheme } from '../theme/ThemeContext';
import type {
  CaptureMetadata,
  TrustLevel,
  VerityCertificate,
} from '../../documentation/technical/verity-protocol';
import { saveCertificate, findCertificateByHash } from '../utils/cryptoUtils';

type CaptureStep = 'idle' | 'hashing' | 'anchoring' | 'done' | 'error';

export default function CaptureScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState<CaptureStep>('idle');
  const [certificate, setCertificate] = useState<VerityCertificate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  /** Calcula el nivel de confianza según el origen del archivo y sus metadatos. */
  function computeTrustLevel(metadata: CaptureMetadata): TrustLevel {
    if (metadata.source === 'camera' && metadata.latitude && metadata.capturedAt) {
      return 'ALTO';
    }
    if (metadata.capturedAt) {
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
      const source = new File(uri);
      await source.copy(destination);
      return destination.uri;
    } catch (error) {
      console.warn('No se pudo guardar la copia permanente de la foto:', error);
      return uri;
    }
  }

  /** Punto de entrada compartido tanto para cámara como para galería. */
  async function processAsset(
    asset: ImagePicker.ImagePickerAsset,
    source: 'camera' | 'gallery'
  ) {
    try {
      setErrorMessage(null);
      setCertificate(null);
      setIsDuplicate(false);
      setStep('hashing');

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
        setCertificate(existing);
        setIsDuplicate(true);
        setStep('done');
        return;
      }

      // 2) Si viene de la cámara, copiarla a una carpeta propia y
      // permanente de la app (la caché de la cámara se puede borrar en
      // cualquier momento). Si viene de galería, ya vive en un lugar
      // persistente del sistema.
      const persistentUri =
        source === 'camera'
          ? await saveCapturePermanently(asset.uri, `${certificateId}.jpg`)
          : asset.uri;

      // 3) Registro en el "registro público" (Polygon Amoy testnet).
      setStep('anchoring');
      const anchor = await anchorHashOnChain(hashResult.sha256);

      // 4) Armar el certificado y guardarlo en el historial local.
      const newCertificate: VerityCertificate = {
        id: certificateId,
        sha256: hashResult.sha256,
        trustLevel: computeTrustLevel(metadata),
        metadata,
        anchor,
        thumbnailUri: persistentUri,
      };

      await saveCertificate(newCertificate);

      setCertificate(newCertificate);
      setStep('done');
    } catch (error) {
      console.error('Error al sellar el archivo:', error);
      setErrorMessage(
        'No pudimos completar el sello. Revisa tu conexión e inténtalo de nuevo.'
      );
      setStep('error');
    }
  }

  async function handleCameraCapture() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Verity necesita acceso a la cámara para sellar fotos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      await processAsset(result.assets[0], 'camera');
    }
  }

  async function handleGalleryPick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Verity necesita acceso a tus fotos para sellarlas.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
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

  // Reduce la fricción de uso: al abrir la app (después del onboarding),
  // se dispara la cámara automáticamente en vez de esperar a que el
  // usuario toque "Tomar foto" — la pantalla de Sellar es la pestaña
  // inicial, así que esto hace que abrir Verity se sienta tan directo
  // como abrir la cámara nativa. Si el usuario cancela o rechaza el
  // permiso, cae de vuelta en la pantalla normal con los dos botones.
  // El ref evita que se repita al cambiar de pestaña y volver (React
  // Navigation mantiene esta pantalla montada), solo ocurre una vez por
  // apertura de la app.
  const autoLaunchedRef = useRef(false);
  useEffect(() => {
    if (autoLaunchedRef.current) return;
    autoLaunchedRef.current = true;
    handleCameraCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Sellar contenido</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Crea una huella digital única de tu foto y regístrala en un registro
          público, sin subir el archivo a ningún lado.
        </Text>
        <SettingsButton />
      </View>

      {step === 'idle' || step === 'error' ? (
        <View style={styles.actions}>
          <CameraButton onPress={handleCameraCapture} label="Tomar foto" />
          <CameraButton onPress={handleGalleryPick} label="Elegir de galería" secondary />
        </View>
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
            <CertificateCard certificate={certificate} onPress={() => setDetailVisible(true)} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { position: 'relative', paddingRight: 48, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14 },
  actions: { gap: 16 },
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
