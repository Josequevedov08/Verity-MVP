/**
 * VerificationScreen.tsx
 * ---------------------------------------------------------------------------
 * Pestaña "Verificar": permite a cualquiera comprobar que un archivo fue
 * sellado, recalculando su huella digital y comparándola contra lo que
 * quedó anclado en el registro público. No requiere haber sellado el
 * archivo desde este mismo dispositivo.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import CameraButton from '../components/CameraButton';
import { hashFile } from '../services/hashService';
import { verifyAnchor } from '../services/blockchainService';

export default function VerificationScreen() {
  const [txHash, setTxHash] = useState('');
  const [result, setResult] = useState<'idle' | 'checking' | 'match' | 'no-match'>(
    'idle'
  );

  async function handlePickAndVerify() {
    if (!txHash.trim()) return;

    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;

    setResult('checking');
    try {
      const { sha256 } = await hashFile(picked.assets[0].uri);
      const isMatch = await verifyAnchor(txHash.trim(), sha256);
      setResult(isMatch ? 'match' : 'no-match');
    } catch (error) {
      console.error('Error al verificar:', error);
      setResult('no-match');
    }
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

      <CameraButton label="Elegir archivo a verificar" onPress={handlePickAndVerify} />

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
  resultBox: { marginTop: 24, alignItems: 'center' },
  matchText: { marginTop: 24, color: '#1e8e3e', fontSize: 16, fontWeight: '600' },
  noMatchText: { marginTop: 24, color: '#c0392b', fontSize: 16, fontWeight: '600' },
});
