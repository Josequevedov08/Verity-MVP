/**
 * CertificatesScreen.tsx
 * ---------------------------------------------------------------------------
 * Pestaña "Mis sellos": historial local de todo lo que el usuario ha
 * sellado en este dispositivo. Se lee de AsyncStorage (cryptoUtils.ts),
 * no de ningún servidor.
 *
 * También ofrece exportar/importar una copia de seguridad de este
 * historial (ver cryptoUtils.ts: buildBackup/importBackup). Es la
 * respuesta a "¿qué pasa si pierdo el teléfono o desinstalo la app?":
 * sin esto, el historial local (miniaturas, fechas, saber qué ya
 * sellaste) se pierde para siempre, aunque los sellos en sí sigan
 * existiendo en la blockchain. Este respaldo NO contiene fotos — solo
 * hashes y números de sello — así que por sí solo no prueba autoría,
 * solo restaura tu propio índice de "qué sellé y cuándo".
 */
import React, { useCallback, useState } from 'react';
import { FlatList, Text, StyleSheet, Pressable, Alert, View } from 'react-native';
// SafeAreaView de 'react-native' está deprecado; se usa el de
// react-native-safe-area-context (requiere <SafeAreaProvider> en App.tsx).
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';

import CertificateCard from '../components/CertificateCard';
import CertificateDetailModal from '../components/CertificateDetailModal';
import SettingsButton from '../components/SettingsButton';
import { useTheme } from '../theme/ThemeContext';
import { getCertificates, buildBackup, importBackup } from '../utils/cryptoUtils';
import type { VerityCertificate, CertificatesBackup } from '../../documentation/technical/verity-protocol';

export default function CertificatesScreen() {
  const { colors } = useTheme();
  const [certificates, setCertificates] = useState<VerityCertificate[]>([]);
  const [selected, setSelected] = useState<VerityCertificate | null>(null);

  // Recarga el historial cada vez que se entra a esta pestaña, para
  // reflejar sellos hechos recién en "Sellar".
  useFocusEffect(
    useCallback(() => {
      getCertificates().then(setCertificates);
    }, [])
  );

  async function handleExport() {
    try {
      const backup = await buildBackup();
      if (backup.certificates.length === 0) {
        Alert.alert('Nada que exportar', 'Todavía no has sellado ninguna foto.');
        return;
      }

      const backupFile = new File(Paths.cache, `verity-backup-${Date.now()}.json`);
      if (!backupFile.exists) backupFile.create({ intermediates: true });
      backupFile.write(JSON.stringify(backup, null, 2));

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('No disponible', 'Compartir archivos no está disponible en este dispositivo.');
        return;
      }

      await Sharing.shareAsync(backupFile.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Guardar copia de seguridad de Verity',
      });
    } catch (error) {
      console.error('Error al exportar la copia de seguridad:', error);
      Alert.alert('Error', 'No se pudo exportar la copia de seguridad.');
    }
  }

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;

      const file = new File(result.assets[0].uri);
      const text = await file.text();
      const backup = JSON.parse(text) as CertificatesBackup;

      if (!backup || !Array.isArray(backup.certificates)) {
        Alert.alert('Archivo inválido', 'Este archivo no es una copia de seguridad de Verity.');
        return;
      }

      const added = await importBackup(backup);
      Alert.alert(
        'Copia de seguridad importada',
        added > 0
          ? `Se agregaron ${added} sello(s) nuevo(s) a tu historial.`
          : 'No había sellos nuevos que agregar (ya los tenías todos).'
      );
      getCertificates().then(setCertificates);
    } catch (error) {
      console.error('Error al importar la copia de seguridad:', error);
      Alert.alert('Error', 'No se pudo leer ese archivo como copia de seguridad de Verity.');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Mis sellos</Text>
        <SettingsButton />
      </View>

      <View style={styles.backupRow}>
        <Pressable
          style={[styles.backupButton, { backgroundColor: colors.surfaceAlt }]}
          onPress={handleExport}
        >
          <Text style={[styles.backupButtonText, { color: colors.accent }]}>
            Exportar copia de seguridad
          </Text>
        </Pressable>
        <Pressable
          style={[styles.backupButton, { backgroundColor: colors.surfaceAlt }]}
          onPress={handleImport}
        >
          <Text style={[styles.backupButtonText, { color: colors.accent }]}>
            Importar copia de seguridad
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={certificates}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CertificateCard certificate={item} onPress={() => setSelected(item)} />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Todavía no has sellado ninguna foto.
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      <CertificateDetailModal
        certificate={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { position: 'relative', paddingRight: 48, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  backupRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  backupButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  backupButtonText: { fontWeight: '600', fontSize: 12, textAlign: 'center' },
  empty: { marginTop: 40, textAlign: 'center' },
});
