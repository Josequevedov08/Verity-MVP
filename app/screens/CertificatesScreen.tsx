/**
 * CertificatesScreen.tsx
 * ---------------------------------------------------------------------------
 * Pestaña "Mis sellos": historial local de todo lo que el usuario ha
 * sellado en este dispositivo. Se lee de AsyncStorage (cryptoUtils.ts),
 * no de ningún servidor.
 *
 * Ofrece dos formas de ver el historial (lista / grilla, alternables con
 * el ícono junto al engranaje) y, al abrir un certificado, se puede
 * deslizar el dedo para pasar al anterior/siguiente sin cerrar el
 * detalle (ver CertificateDetailModal: recibe la lista completa).
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
import { FlatList, Text, StyleSheet, Pressable, Alert, View, Image } from 'react-native';
// SafeAreaView de 'react-native' está deprecado; se usa el de
// react-native-safe-area-context (requiere <SafeAreaProvider> en App.tsx).
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import Ionicons from '@expo/vector-icons/Ionicons';

import CertificateCard from '../components/CertificateCard';
import CertificateDetailModal from '../components/CertificateDetailModal';
import SettingsButton from '../components/SettingsButton';
import { useTheme } from '../theme/ThemeContext';
import { getCertificates, buildBackup, importBackup } from '../utils/cryptoUtils';
import type { VerityCertificate, CertificatesBackup } from '../../documentation/technical/verity-protocol';

type ViewMode = 'list' | 'grid';

export default function CertificatesScreen() {
  const { colors } = useTheme();
  const [certificates, setCertificates] = useState<VerityCertificate[]>([]);
  const [selected, setSelected] = useState<VerityCertificate | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Mis sellos</Text>
        <View style={styles.headerIcons}>
          <Pressable
            style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            hitSlop={8}
          >
            <Ionicons
              name={viewMode === 'list' ? 'grid-outline' : 'reorder-three-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
          <SettingsButton inline />
        </View>
      </View>

      <View style={styles.backupRow}>
        <Pressable
          style={[styles.backupButton, { borderColor: colors.accent }]}
          onPress={handleExport}
        >
          <Text style={[styles.backupButtonText, { color: colors.accent }]}>
            Exportar copia de seguridad
          </Text>
        </Pressable>
        <Pressable
          style={[styles.backupButton, { borderColor: colors.accent }]}
          onPress={handleImport}
        >
          <Text style={[styles.backupButtonText, { color: colors.accent }]}>
            Importar copia de seguridad
          </Text>
        </Pressable>
      </View>

      {viewMode === 'list' ? (
        <FlatList
          key="list"
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
      ) : (
        <FlatList
          key="grid"
          data={certificates}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <GridTile certificate={item} onPress={() => setSelected(item)} />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Todavía no has sellado ninguna foto.
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      <CertificateDetailModal
        certificate={selected}
        certificates={certificates}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

function GridTile({ certificate, onPress }: { certificate: VerityCertificate; onPress: () => void }) {
  const { colors } = useTheme();
  const dotColor =
    certificate.trustLevel === 'ALTO'
      ? colors.success
      : certificate.trustLevel === 'MEDIO'
        ? colors.warning
        : colors.tabBarInactive;

  return (
    <Pressable style={styles.gridTile} onPress={onPress}>
      {certificate.thumbnailUri ? (
        <Image source={{ uri: certificate.thumbnailUri }} style={[styles.gridImage, { borderColor: colors.border }]} />
      ) : (
        <View style={[styles.gridImage, styles.gridImagePlaceholder, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} />
      )}
      <View style={[styles.gridDot, { backgroundColor: dotColor, borderColor: colors.background }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  backupButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    alignItems: 'center',
  },
  backupButtonText: { fontWeight: '600', fontSize: 12, textAlign: 'center' },
  empty: { marginTop: 40, textAlign: 'center' },
  gridRow: { gap: 8, marginBottom: 8 },
  gridTile: { flex: 1 / 3, aspectRatio: 1, position: 'relative' },
  gridImage: { flex: 1, borderRadius: 12, borderWidth: 1 },
  gridImagePlaceholder: {},
  gridDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
