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

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { randomUUID } from 'expo-crypto';

import { hashFile } from '../services/hashService';
import { anchorHashOnChain } from '../services/blockchainService';
import CameraButton from '../components/CameraButton';
import CertificateCard from '../components/CertificateCard';
import CertificateDetailModal from '../components/CertificateDetailModal';
import type {
  CaptureMetadata,
  TrustLevel,
  VerityCertificate,
} from '../../documentation/technical/verity-protocol';
import { saveCertificate } from '../utils/cryptoUtils';

type CaptureStep = 'idle' | 'hashing' | 'anchoring' | 'done' | 'error';

export default function CaptureScreen() {
  const [step, setStep] = useState<CaptureStep>('idle');
  const [certificate, setCertificate] = useState<VerityCertificate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

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
   * Guarda una foto tomada con la cámara de la app en la galería del
   * dispositivo. Sin esto, la foto solo existe en una caché temporal y
   * desaparece — dejando al usuario sin forma de volver a elegirla más
   * tarde en la pestaña "Verificar". Si el usuario no da el permiso, el
   * sello se sigue completando igual (solo que la miniatura y la
   * posibilidad de re-verificar esa foto puntual quedan limitadas a esta
   * sesión).
   */
  async function saveToDeviceGallery(uri: string): Promise<string> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return uri;

      const asset = await MediaLibrary.Asset.create(uri);
      return await asset.getUri();
    } catch (error) {
      console.warn('No se pudo guardar la foto en la galería:', error);
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
      setStep('hashing');

      // Metadatos disponibles. GPS solo se intenta pedir cuando la captura
      // viene de la cámara de la app (nivel ALTO), para no pedir permisos
      // de ubicación innecesarios si el usuario solo sube algo de galería.
      const metadata: CaptureMetadata = {
        source,
        capturedAt: asset.exif?.DateTimeOriginal ?? new Date().toISOString(),
      };

      if (source === 'camera') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({});
          metadata.latitude = position.coords.latitude;
          metadata.longitude = position.coords.longitude;
        }
      }

      // 1) Huella digital, calculada 100% en el dispositivo (sobre el
      // archivo original, antes de moverlo a ningún lado).
      const hashResult = await hashFile(asset.uri);

      // 2) Si viene de la cámara, guardarla en la galería del dispositivo
      // para que el usuario pueda volver a elegirla en "Verificar" más
      // adelante. Si viene de galería, ya está ahí.
      const persistentUri =
        source === 'camera' ? await saveToDeviceGallery(asset.uri) : asset.uri;

      // 3) Registro en el "registro público" (Polygon Amoy testnet).
      setStep('anchoring');
      const anchor = await anchorHashOnChain(hashResult.sha256);

      // 4) Armar el certificado y guardarlo en el historial local.
      const newCertificate: VerityCertificate = {
        id: randomUUID(),
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
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Sellar contenido</Text>
      <Text style={styles.subtitle}>
        Crea una huella digital única de tu foto y regístrala en un registro
        público, sin subir el archivo a ningún lado.
      </Text>

      {step === 'idle' || step === 'error' ? (
        <View style={styles.actions}>
          <CameraButton onPress={handleCameraCapture} label="Tomar foto" />
          <CameraButton onPress={handleGalleryPick} label="Elegir de galería" secondary />
        </View>
      ) : null}

      {(step === 'hashing' || step === 'anchoring') && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            {step === 'hashing'
              ? 'Calculando huella digital...'
              : 'Registrando en el registro público...'}
          </Text>
        </View>
      )}

      {step === 'error' && errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}

      {step === 'done' && certificate && (
        <>
          <CertificateCard certificate={certificate} onPress={() => setDetailVisible(true)} />
          <Pressable style={styles.sealAnotherButton} onPress={handleSealAnother}>
            <Text style={styles.sealAnotherText}>Sellar otra foto</Text>
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
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 24 },
  actions: { gap: 16 },
  loadingBox: { alignItems: 'center', marginTop: 40, gap: 12 },
  loadingText: { fontSize: 14, color: '#555' },
  errorText: { color: '#c0392b', marginTop: 16 },
  sealAnotherButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#eef2f7',
  },
  sealAnotherText: { color: '#1a73e8', fontWeight: '600' },
});
