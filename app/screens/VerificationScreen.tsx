/**
 * VerificationScreen.tsx
 * ---------------------------------------------------------------------------
 * Pestaña "Verificar". Tiene DOS formas de buscar, independientes entre sí:
 *
 * 1) Por ARCHIVO: eliges una foto (de tu galería o de "Mis sellos") y
 *    Verity la hashea y busca sola si coincide con algo en tu historial
 *    local. Responde "¿ya sellé esto?".
 *
 * 2) Por NÚMERO DE SELLO: escribes un número de sello a mano y tocas
 *    "Buscar". Responde "¿este sello existe?" —
 *      - Si corresponde a un sello de ESTE dispositivo, se muestra el
 *        certificado completo, con foto, igual que en "Mis sellos".
 *      - Si no, se consulta directamente la blockchain: si existe, se
 *        confirma que es real (mostrando la huella digital que quedó
 *        anclada), sin necesitar ningún archivo para compararlo.
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
import { lookupAnchorByTxHash } from '../services/blockchainService';
import { getCertificates, findCertificateByHash, findCertificateByTxHash } from '../utils/cryptoUtils';
import CameraButton from '../components/CameraButton';
import CertificateCard from '../components/CertificateCard';
import CertificateDetailModal from '../components/CertificateDetailModal';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

type FileSearchResult =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'found'; certificate: VerityCertificate }
  | { status: 'not-found' };

type HashSearchResult =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'found-local'; certificate: VerityCertificate }
  | { status: 'found-on-chain'; sha256: string; explorerUrl: string }
  | { status: 'not-found' };

export default function VerificationScreen() {
  // --- Búsqueda por archivo ---
  const [fileResult, setFileResult] = useState<FileSearchResult>({ status: 'idle' });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [certificates, setCertificates] = useState<VerityCertificate[]>([]);
  const [fileDetailVisible, setFileDetailVisible] = useState(false);

  // --- Búsqueda por número de sello ---
  const [sealInput, setSealInput] = useState('');
  const [hashResult, setHashResult] = useState<HashSearchResult>({ status: 'idle' });
  const [hashDetailVisible, setHashDetailVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getCertificates().then(setCertificates);
    }, [])
  );

  // ---------------- Búsqueda por archivo ----------------

  async function checkFile(uri: string) {
    setFileResult({ status: 'checking' });
    try {
      const { sha256 } = await hashFile(uri);
      const localMatch = await findCertificateByHash(sha256);
      setFileResult(localMatch ? { status: 'found', certificate: localMatch } : { status: 'not-found' });
    } catch (error) {
      console.error('Error al verificar el archivo:', error);
      setFileResult({ status: 'not-found' });
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

  // ---------------- Búsqueda por número de sello ----------------

  async function handleSearchBySeal() {
    const seal = sealInput.trim();
    if (!seal) {
      Alert.alert('Falta el número de sello', 'Escribe el número de sello (0x...) a buscar.');
      return;
    }

    setHashResult({ status: 'checking' });

    // 1) ¿Es un sello hecho en ESTE dispositivo? Si sí, mostramos el
    // certificado completo (con foto), sin necesidad de consultar la
    // blockchain — ya lo tenemos guardado localmente.
    const localMatch = await findCertificateByTxHash(seal);
    if (localMatch) {
      setHashResult({ status: 'found-local', certificate: localMatch });
      return;
    }

    // 2) No es de este dispositivo. Puede ser un sello real hecho desde
    // otro teléfono — lo consultamos directo en la blockchain, sin
    // necesitar ningún archivo para comparar, solo para confirmar que
    // existe.
    const lookup = await lookupAnchorByTxHash(seal);
    if (lookup.exists && lookup.sha256 && lookup.explorerUrl) {
      setHashResult({ status: 'found-on-chain', sha256: lookup.sha256, explorerUrl: lookup.explorerUrl });
    } else {
      setHashResult({ status: 'not-found' });
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Verificar contenido</Text>

      {/* ---------------- Sección 1: por archivo ---------------- */}
      <Text style={styles.sectionTitle}>Por archivo</Text>
      <Text style={styles.subtitle}>Elige una foto y Verity revisa sola si ya la sellaste.</Text>

      <View style={styles.actions}>
        <CameraButton label="Elegir de mi galería" onPress={handlePickFromGallery} />
        <CameraButton
          label="Elegir de Mis sellos"
          secondary
          onPress={() => setPickerVisible(true)}
        />
      </View>

      {fileResult.status === 'checking' && (
        <View style={styles.resultBox}>
          <ActivityIndicator />
        </View>
      )}
      {fileResult.status === 'found' && (
        <Pressable style={styles.resultBox} onPress={() => setFileDetailVisible(true)}>
          <Text style={styles.matchText}>
            ✅ Esta foto ya está sellada. Toca para ver el certificado completo.
          </Text>
        </Pressable>
      )}
      {fileResult.status === 'not-found' && (
        <Text style={[styles.noMatchText, styles.resultBox]}>
          No encontramos esta foto en tu historial local. Si crees que fue sellada
          desde otro dispositivo, usa "Por número de sello" más abajo.
        </Text>
      )}

      {fileResult.status === 'found' && (
        <CertificateDetailModal
          certificate={fileResult.certificate}
          visible={fileDetailVisible}
          onClose={() => setFileDetailVisible(false)}
        />
      )}

      <View style={styles.divider} />

      {/* ---------------- Sección 2: por número de sello ---------------- */}
      <Text style={styles.sectionTitle}>Por número de sello</Text>
      <Text style={styles.subtitle}>
        Escribe un número de sello (por ejemplo, uno que te haya pasado otra
        persona) para confirmar si existe de verdad.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Número de sello (0x...)"
        value={sealInput}
        onChangeText={setSealInput}
        autoCapitalize="none"
      />
      <Pressable style={styles.searchButton} onPress={handleSearchBySeal}>
        <Text style={styles.searchButtonText}>Buscar</Text>
      </Pressable>

      {hashResult.status === 'checking' && (
        <View style={styles.resultBox}>
          <ActivityIndicator />
        </View>
      )}

      {hashResult.status === 'found-local' && (
        <View style={styles.resultBox}>
          <Text style={styles.matchText}>✅ Este sello es de tu dispositivo:</Text>
          <CertificateCard
            certificate={hashResult.certificate}
            onPress={() => setHashDetailVisible(true)}
          />
          <CertificateDetailModal
            certificate={hashResult.certificate}
            visible={hashDetailVisible}
            onClose={() => setHashDetailVisible(false)}
          />
        </View>
      )}

      {hashResult.status === 'found-on-chain' && (
        <View style={styles.resultBox}>
          <Text style={styles.matchText}>
            ✅ Este número de sello existe en el registro público (no es de este
            dispositivo, así que no tenemos la foto para mostrarte).
          </Text>
          <Text style={styles.hashLabel}>Huella digital anclada</Text>
          <Text style={styles.hashValue} selectable>
            {hashResult.sha256}
          </Text>
        </View>
      )}

      {hashResult.status === 'not-found' && (
        <Text style={[styles.noMatchText, styles.resultBox]}>
          ❌ No se encontró ninguna transacción con ese número de sello.
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
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a73e8', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#555', marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  searchButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  searchButtonText: { color: '#fff', fontWeight: '700' },
  actions: { gap: 12 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 28 },
  resultBox: { marginTop: 20 },
  matchText: { color: '#1e8e3e', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  noMatchText: { color: '#c0392b', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  hashLabel: { fontSize: 12, color: '#888', marginTop: 8 },
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
