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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, StyleSheet, Pressable, Alert, View } from 'react-native';
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
import MediaThumbnail from '../components/MediaThumbnail';
import SettingsButton from '../components/SettingsButton';
import CoachMark from '../components/CoachMark';
import StatsCard from '../components/StatsCard';
import { useTheme } from '../theme/ThemeContext';
import { getCertificates, buildBackup, importBackup } from '../utils/cryptoUtils';
import { hasSeenCoachMark, markCoachMarkSeen, useCoachMarkResetVersion } from '../utils/coachMarkUtils';
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

  // Recorrido guiado (una sola vez, la primera vez que se entra aquí).
  const [showTour, setShowTour] = useState(false);
  const toggleButtonRef = useRef<View>(null);
  const statsCardRef = useRef<View>(null);
  const backupRowRef = useRef<View>(null);
  const coachResetVersion = useCoachMarkResetVersion();
  useEffect(() => {
    hasSeenCoachMark('certificates').then((seen) => setShowTour(!seen));
  }, [coachResetVersion]);

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

      // Nota: antes se leía con la clase File nueva de expo-file-system,
      // pero es más estricta con las rutas que entrega el selector de
      // documentos de Android (fallaba con "Call to function ... has
      // been rejected" según el tipo de app usada para elegir el
      // archivo). fetch() es la forma más robusta y estándar en React
      // Native para leer un archivo elegido por el usuario, sin
      // importar si la ruta es file:// o content://.
      const text = await fetch(result.assets[0].uri).then((res) => res.text());
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
    <>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Mis sellos</Text>
        <View style={styles.headerIcons}>
          <View ref={toggleButtonRef} collapsable={false}>
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
          </View>
          <SettingsButton inline />
        </View>
      </View>

      {certificates.length > 0 && (
        <View ref={statsCardRef} collapsable={false}>
          <StatsCard certificates={certificates} />
        </View>
      )}

      <View style={styles.backupRow} ref={backupRowRef} collapsable={false}>
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

    {/* Hermano del SafeAreaView (no hijo) — ver nota en CoachMark.tsx. */}
    <CoachMark
        visible={showTour}
        steps={[
          {
            targetRef: toggleButtonRef,
            title: 'Lista o grilla, como prefieras',
            text: 'Toca aquí para cambiar entre ver tu historial en lista (con detalle) o en grilla (como una galería) — el nivel de confianza de cada sello se ve igual en ambas.',
          },
          // Solo si ya hay certificados (StatsCard no se renderiza
          // vacía) — si no, este paso no tendría nada que medir y la
          // guía se quedaría trabada esperando un elemento que no existe.
          ...(certificates.length > 0
            ? [
                {
                  targetRef: statsCardRef,
                  title: 'Nivel de confianza: Alta, Media, Baja',
                  text: 'No dice si tu foto o video es real o falso — dice qué tanta información hay sobre cómo se tomó. Toca la insignia de confianza dentro de cualquier certificado para más detalle.',
                },
              ]
            : []),
          {
            targetRef: backupRowRef,
            title: 'No pierdas tu historial',
            text: 'Exporta una copia de seguridad de vez en cuando (sin fotos, solo hashes y fechas) para poder restaurarla si cambias de teléfono. Tip: toca cualquier certificado y luego LA CARTA para verla girar y mostrar la foto o video real.',
          },
        ]}
        onFinish={() => {
          setShowTour(false);
          markCoachMarkSeen('certificates');
        }}
      />
    </>
  );
}

/**
 * Explica qué significan los íconos de escudo en las miniaturas de la
 * grilla. Se movió a StatsCard.tsx (arriba de todo) para no repetir la
 * misma info dos veces en la misma pantalla — antes existía esta
 * leyenda por separado, redundante con el desglose de la tarjeta de
 * estadísticas.
 */
function GridTile({ certificate, onPress }: { certificate: VerityCertificate; onPress: () => void }) {
  const { colors } = useTheme();
  const trustIcon =
    certificate.trustLevel === 'ALTO'
      ? 'shield-checkmark'
      : certificate.trustLevel === 'MEDIO'
        ? 'shield-half'
        : 'shield-outline';
  const trustColor =
    certificate.trustLevel === 'ALTO'
      ? colors.success
      : certificate.trustLevel === 'MEDIO'
        ? colors.warning
        : colors.tabBarInactive;

  return (
    <Pressable style={styles.gridTile} onPress={onPress}>
      <MediaThumbnail
        uri={certificate.thumbnailUri}
        mediaType={certificate.metadata.mediaType}
        previewUri={certificate.previewImageUri}
        trustLevel={certificate.trustLevel}
        style={[styles.gridImage, { borderColor: colors.border }]}
        iconSize={22}
      />
      <View style={[styles.gridBadge, { backgroundColor: colors.background }]}>
        <Ionicons name={trustIcon} size={13} color={trustColor} />
      </View>
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
  gridImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  gridBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
