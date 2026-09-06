/**
 * VerificationScreen.tsx
 * ---------------------------------------------------------------------------
 * Pestaña "Verificar": permite a cualquiera comprobar que un archivo fue
 * sellado, recalculando su huella digital y comparándola contra lo que
 * quedó anclado en el registro público. No requiere haber sellado el
 * archivo desde este mismo dispositivo.
 *
 * Ofrece dos formas de elegir el archivo a comprobar:
 * - "Elegir de mi galería": para cualquier archivo (el caso general,
 *   pensado para verificar contenido de otra persona).
 * - "Elegir de Mis sellos": atajo sobre el historial local de este
 *   dispositivo, útil para probar rápido con algo que ya sellaste (por
 *   ejemplo, una foto tomada con la cámara de la app, que vive en el
 *   almacenamiento propio de Verity en vez de la galería del sistema).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

import CameraButton from '../components/CameraButton';
import { hashFile } from '../services/hashService';
import { verifyAnchor } from '../services/blockchainService';
import { getCertificates } from '../utils/cryptoUtils';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

export default function VerificationScreen() {
  const [txHash, setTxHash] = useState('');
  const [result, setResult] = useState<'idle' | 'checking' | 'match' | 'no-match'>(
    'idle'
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [certificates, setCertificates] = useState<VerityCertificate[]>([]);

  useFocusEffect(
    useCallback(() => {
      getCertificates().then(setCertificates);
    }, [])
  );

  async function verifyFile(uri: string, hashToCheck: string) {
    setResult('checking');
    try {
      const { sha256 } = await hashFile(uri);
      const isMatch = await verifyAnchor(hashToCheck.trim(), sha256);
      setResult(isMatch ? 'match' : 'no-match');
    } catch (error) {
      console.error('Error al verificar:', error);
      setResult('no-match');
    }
  }

  async function handlePickFromGallery() {
    // Antes esto simplemente no hacía nada visible si faltaba el número
    // de sello, y parecía que el botón estaba roto. Ahora avisa.
    if (!txHash.trim()) {
      Alert.alert(
        'Falta el número de sello',
        'Pega primero el número de sello (0x...) antes de elegir el archivo a comprobar.'
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Verity necesita acceso a tus fotos para verificarlas.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;

    await verifyFile(picked.assets[0].uri, txHash);
  }

  function handlePickFromHistory(certificate: VerityCertificate) {
    setPickerVisible(false);
    if (!certificate.thumbnailUri) return;

    setTxHash(certificate.anchor.txHash);
    verifyFile(certificate.thumbnailUri, certificate.anchor.txHash);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Verificar contenido</Text>
      <Text style={styles.subtitle}>
        Pega el número de sello (código del registro público) y elige el
        archivo que quieres comprobar.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Número de sello (0x...)"
        value={txHash}
        onChangeText={setTxHash}
        autoCapitalize="none"
      />

      <View style={styles.actions}>
        <CameraButton label="Elegir de mi galería" onPress={handlePickFromGallery} />
        <CameraButton
          label="Elegir de Mis sellos"
          secondary
          onPress={() => setPickerVisible(true)}
        />
      </View>

      {result === 'checking' && (
        <View style={styles.resultBox}>
          <ActivityIndicator />
        </View>
      )}
      {result === 'match' && (
        <Text style={styles.matchText}>✅ Este archivo coincide con el sello.</Text>
      )}
      {result === 'no-match' && (
        <Text style={styles.noMatchText}>
          ❌ Este archivo NO coincide con el sello indicado.
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
    marginBottom: 16,
  },
  actions: { gap: 12 },
  resultBox: { marginTop: 24, alignItems: 'center' },
  matchText: { marginTop: 24, color: '#1e8e3e', fontSize: 16, fontWeight: '600' },
  noMatchText: { marginTop: 24, color: '#c0392b', fontSize: 16, fontWeight: '600' },
  pickerContainer: { flex: 1, backgroundColor: '#fff', padding: 24 },
  closeButton: { alignSelf: 'flex-end', marginBottom: 12 },
  closeText: { fontSize: 15, color: '#1a73e8', fontWeight: '600' },
  pickerRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'center' },
  pickerThumbnail: { width: 56, height: 56, borderRadius: 10 },
  pickerHash: { fontSize: 12, fontFamily: 'monospace', color: '#222' },
  pickerDate: { fontSize: 12, color: '#888', marginTop: 2 },
  empty: { color: '#888', marginTop: 40, textAlign: 'center' },
});
