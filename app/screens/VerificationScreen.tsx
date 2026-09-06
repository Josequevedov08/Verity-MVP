/**
 * VerificationScreen.tsx
 * ---------------------------------------------------------------------------
 * Pestaña "Verificar". Flujo pensado de la forma más natural posible:
 *
 *   1. Elegir el archivo primero (de la galería o de "Mis sellos").
 *   2. Verity calcula su huella digital y busca sola si coincide con
 *      algún sello guardado en el historial local de este dispositivo.
 *   3. Si lo encuentra: muestra el número de sello automáticamente.
 *      Si NO lo encuentra localmente: no significa que el archivo no
 *      esté sellado — puede haberse sellado desde OTRO dispositivo, cuyo
 *      historial este teléfono no puede ver (no hay servidor central).
 *      En ese caso se le pide al usuario el número de sello (si lo
 *      tiene, por ejemplo porque se lo pasó la otra persona) para
 *      comprobarlo directamente contra el registro público.
 *
 * Antes, este flujo pedía el número de sello ANTES de elegir el archivo,
 * lo cual era confuso: la mayoría de las veces uno quiere comprobar "¿yo
 * ya sellé esto?", no "yo sé el número de sello, ¿coincide con este
 * archivo?". Ahora cubre ambos casos, en el orden natural.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  Pressable,
  Alert,
} from 'react-native';
// SafeAreaView de 'react-native' está deprecado; se usa el de
// react-native-safe-area-context (requiere <SafeAreaProvider> en App.tsx).
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

import { hashFile } from '../services/hashService';
import { verifyAnchor } from '../services/blockchainService';
import { getCertificates, findCertificateByHash } from '../utils/cryptoUtils';
import CameraButton from '../components/CameraButton';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

type VerifyResult =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'found-local'; certificate: VerityCertificate }
  | { status: 'not-found-local' }
  | { status: 'match-manual' }
  | { status: 'no-match-manual' };

export default function VerificationScreen() {
  const [manualHash, setManualHash] = useState('');
  const [result, setResult] = useState<VerifyResult>({ status: 'idle' });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [certificates, setCertificates] = useState<VerityCertificate[]>([]);

  useFocusEffect(
    useCallback(() => {
      getCertificates().then(setCertificates);
    }, [])
  );

  /**
   * Punto de entrada único: hashea el archivo elegido y primero busca en
   * el historial LOCAL (gratis, instantáneo, no depende de internet).
   * Solo si no encuentra nada ahí, y el usuario ya escribió un número de
   * sello manualmente, lo compara contra el registro público.
   */
  async function checkFile(uri: string) {
    setResult({ status: 'checking' });
    try {
      const { sha256 } = await hashFile(uri);

      const localMatch = await findCertificateByHash(sha256);
      if (localMatch) {
        setManualHash(localMatch.anchor.txHash);
        setResult({ status: 'found-local', certificate: localMatch });
        return;
      }

      // No está en el historial de este dispositivo. Si el usuario ya
      // tenía un número de sello escrito (por ejemplo, se lo pasó otra
      // persona), lo comprobamos directamente contra la blockchain.
      if (manualHash.trim()) {
        const isMatch = await verifyAnchor(manualHash.trim(), sha256);
        setResult(isMatch ? { status: 'match-manual' } : { status: 'no-match-manual' });
        return;
      }

      setResult({ status: 'not-found-local' });
    } catch (error) {
      console.error('Error al verificar:', error);
      setResult({ status: 'not-found-local' });
    }
  }

  async function handlePickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Verity necesita acceso a tus fotos para verificarlas.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;

    await checkFile(picked.assets[0].uri);
  }

  function handlePickFromHistory(certificate: VerityCertificate) {
    setPickerVisible(false);
    if (!certificate.thumbnailUri) return;
    checkFile(certificate.thumbnailUri);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Verificar contenido</Text>
      <Text style={styles.subtitle}>
        Elige una foto y Verity revisa sola si ya la sellaste. Si no la
        reconoce, puedes escribir un número de sello (por ejemplo, uno que
        te haya pasado otra persona) para comprobarlo directamente.
      </Text>

      <View style={styles.actions}>
        <CameraButton label="Elegir de mi galería" onPress={handlePickFromGallery} />
        <CameraButton
          label="Elegir de Mis sellos"
          secondary
          onPress={() => setPickerVisible(true)}
        />
      </View>

      {result.status === 'checking' && (
        <View style={styles.resultBox}>
          <ActivityIndicator />
        </View>
      )}

      {result.status === 'found-local' && (
        <View style={styles.resultBox}>
          <Text style={styles.matchText}>
            ✅ Esta foto ya está sellada — coincide con el sello de tu historial.
          </Text>
          <Text style={styles.hashLabel}>Número de sello</Text>
          <Text style={styles.hashValue} selectable>
            {result.certificate.anchor.txHash}
          </Text>
        </View>
      )}

      {result.status === 'not-found-local' && (
        <View style={styles.resultBox}>
          <Text style={styles.noMatchText}>
            No encontramos ese archivo en tu historial local.
          </Text>
          <Text style={styles.hint}>
            Eso no significa que no esté sellado: puede haberse sellado desde
            otro dispositivo. Si tienes el número de sello (te lo puede pasar
            quien lo selló), escríbelo aquí y vuelve a elegir el archivo:
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Número de sello (0x...)"
            value={manualHash}
            onChangeText={setManualHash}
            autoCapitalize="none"
          />
        </View>
      )}

      {result.status === 'match-manual' && (
        <Text style={styles.matchText}>
          ✅ Este archivo coincide con el número de sello indicado.
        </Text>
      )}
      {result.status === 'no-match-manual' && (
        <Text style={styles.noMatchText}>
          ❌ Este archivo NO coincide con el número de sello indicado.
        </Text>
      )}

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView style={styles.pickerContainer}>
          <Pressable onPress={() => setPickerVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeText}>Cerrar ✕</Text>
          </Pressable>
          <Text style={styles.title}>Elegir de Mis sellos</Text>
          <FlatList
            data={certificates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.pickerRow} onPress={() => handlePickFromHistory(item)}>
                {item.thumbnailUri && (
                  <Image source={{ uri: item.thumbnailUri }} style={styles.pickerThumbnail} />
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.pickerHash}>
                    {item.sha256}
                  </Text>
                  <Text style={styles.pickerDate}>
                    {new Date(item.anchor.anchoredAt).toLocaleString()}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Todavía no has sellado ninguna foto.</Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  actions: { gap: 12 },
  resultBox: { marginTop: 24 },
  matchText: { color: '#1e8e3e', fontSize: 16, fontWeight: '600' },
  noMatchText: { color: '#c0392b', fontSize: 15, fontWeight: '600' },
  hint: { color: '#555', fontSize: 13, marginTop: 8, lineHeight: 19 },
  hashLabel: { fontSize: 12, color: '#888', marginTop: 12 },
  hashValue: { fontSize: 12, fontFamily: 'monospace', color: '#222', marginTop: 4 },
  pickerContainer: { flex: 1, backgroundColor: '#fff', padding: 24 },
  closeButton: { alignSelf: 'flex-end', marginBottom: 12 },
  closeText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  pickerRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'center' },
  pickerThumbnail: { width: 56, height: 56, borderRadius: 10 },
  pickerHash: { fontSize: 12, fontFamily: 'monospace', color: '#222' },
  pickerDate: { fontSize: 12, color: '#888', marginTop: 2 },
  empty: { color: '#888', marginTop: 40, textAlign: 'center' },
});
