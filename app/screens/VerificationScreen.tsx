/**
 * VerificationScreen.tsx
 * ---------------------------------------------------------------------------
 * Pestaña "Verificar". Tiene DOS formas de buscar, independientes entre sí:
 *
 * 1) Por ARCHIVO: eliges una foto (de tu galería o de "Mis sellos") y
 *    Verity la hashea y busca sola si coincide con algo en tu historial
 *    local — y si no, también contra el índice público (Supabase, ver
 *    verificationIndexService.ts), por si se selló desde OTRO
 *    dispositivo. Responde "¿ya sellé esto?" sin necesitar el número de
 *    sello a mano.
 *
 * 2) Por NÚMERO DE SELLO: escribes un número de sello a mano y tocas
 *    "Buscar". Responde "¿este sello existe?" —
 *      - Si corresponde a un sello de ESTE dispositivo, se muestra el
 *        certificado completo, con foto, igual que en "Mis sellos".
 *      - Si no, se consulta directamente la blockchain: si existe, se
 *        confirma que es real (mostrando la huella digital que quedó
 *        anclada), sin necesitar ningún archivo para compararlo.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  ScrollView,
  Linking,
} from 'react-native';
// SafeAreaView de 'react-native' está deprecado; se usa el de
// react-native-safe-area-context (requiere <SafeAreaProvider> en App.tsx).
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { hashFile } from '../services/hashService';
import { lookupAnchorByTxHash } from '../services/blockchainService';
import { lookupInPublicIndex, type PublicIndexEntry } from '../services/verificationIndexService';
import { getCertificates, findCertificateByHash, findCertificateByTxHash } from '../utils/cryptoUtils';
import CameraButton from '../components/CameraButton';
import CertificateCard from '../components/CertificateCard';
import CertificateDetailModal from '../components/CertificateDetailModal';
import SettingsButton from '../components/SettingsButton';
import CoachMark from '../components/CoachMark';
import { useTheme } from '../theme/ThemeContext';
import { hasSeenCoachMark, markCoachMarkSeen, useCoachMarkResetVersion } from '../utils/coachMarkUtils';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

type FileSearchResult =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'found'; certificate: VerityCertificate }
  /** Encontrado en el índice público (sellado en OTRO dispositivo) — no
   * hay foto que mostrar, solo los metadatos ya públicos en la cadena. */
  | { status: 'found-public'; entry: PublicIndexEntry }
  | { status: 'not-found' };

type HashSearchResult =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'found-local'; certificate: VerityCertificate }
  | { status: 'found-on-chain'; sha256: string; explorerUrl: string }
  | { status: 'not-found' };

/** Un número de sello completo tiene esta forma exacta: 0x + 64 hex. */
const FULL_TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export default function VerificationScreen() {
  const { colors } = useTheme();
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

  // Recorrido guiado (una sola vez, la primera vez que se entra aquí).
  const [showTour, setShowTour] = useState(false);
  const byFileRef = useRef<View>(null);
  const sealInputRef = useRef<View>(null);
  const coachResetVersion = useCoachMarkResetVersion();
  useEffect(() => {
    hasSeenCoachMark('verification').then((seen) => setShowTour(!seen));
  }, [coachResetVersion]);

  // ---------------- Búsqueda por archivo ----------------

  async function checkFile(uri: string) {
    setFileResult({ status: 'checking' });
    try {
      const { sha256 } = await hashFile(uri);

      const localMatch = await findCertificateByHash(sha256);
      if (localMatch) {
        setFileResult({ status: 'found', certificate: localMatch });
        return;
      }

      // No está en ESTE dispositivo — puede haberse sellado desde otro.
      // El índice público (ver verificationIndexService.ts) permite
      // confirmarlo por el hash, sin necesitar el número de sello a mano.
      const publicMatch = await lookupInPublicIndex(sha256);
      setFileResult(publicMatch ? { status: 'found-public', entry: publicMatch } : { status: 'not-found' });
    } catch (error) {
      console.error('Error al verificar el archivo:', error);
      setFileResult({ status: 'not-found' });
    }
  }

  async function handlePickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Verity necesita acceso a tus fotos y videos para verificarlos.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return;

    await checkFile(picked.assets[0].uri);
  }

  function handlePickFromHistory(certificate: VerityCertificate) {
    setPickerVisible(false);
    if (!certificate.thumbnailUri) return;
    checkFile(certificate.thumbnailUri);
  }

  // ---------------- Búsqueda por número de sello ----------------

  async function runSealSearch(seal: string) {
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

  function handleSearchBySeal() {
    const seal = sealInput.trim();
    if (!seal) {
      Alert.alert('Falta el número de sello', 'Escribe el número de sello (0x...) a buscar.');
      return;
    }
    runSealSearch(seal);
  }

  /**
   * Antes, el resultado de una búsqueda anterior se quedaba "pegado" en
   * pantalla aunque borraras o cambiaras el texto — se sentía roto,
   * desconectado de lo que había en el campo. Ahora:
   * - Cualquier cambio en el texto limpia el resultado anterior de
   *   inmediato (nunca queda un resultado que no corresponde a lo que
   *   se ve en el campo).
   * - Si lo que queda escrito es un número de sello completo y válido
   *   (0x + 64 caracteres — lo normal al pegar uno), se busca solo,
   *   sin tener que tocar "Buscar" — se siente "en vivo".
   */
  const sealDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSealInputChange(text: string) {
    setSealInput(text);
    setHashResult({ status: 'idle' });

    if (sealDebounceRef.current) clearTimeout(sealDebounceRef.current);
    const trimmed = text.trim();
    if (FULL_TX_HASH.test(trimmed)) {
      sealDebounceRef.current = setTimeout(() => runSealSearch(trimmed), 400);
    }
  }

  useEffect(() => {
    return () => {
      if (sealDebounceRef.current) clearTimeout(sealDebounceRef.current);
    };
  }, []);

  return (
    <>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Verificar contenido</Text>
        <SettingsButton />
      </View>

      {/* Encabezado ilustrado: le da a la pantalla la sensación de estar
          entrando a un lugar donde se comprueban cosas importantes, no
          solo un formulario de búsqueda. */}
      <View style={styles.notaryHeader}>
        <View style={[styles.notarySeal, { borderColor: colors.accent }]}>
          <Ionicons name="shield-checkmark" size={30} color={colors.accent} />
        </View>
        <Text style={[styles.notaryText, { color: colors.textMuted }]}>
          Todo lo que se verifica aquí queda comprobado directamente contra
          el registro público de Polygon. Nadie puede alterarlo después.
        </Text>
      </View>

      {/* ---------------- Sección 1: por archivo ---------------- */}
      <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="image-outline" size={16} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>Por archivo</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Elige una foto o video y Verity revisa sola si ya lo sellaste.
        </Text>

        <View style={styles.actions} ref={byFileRef} collapsable={false}>
          <CameraButton label="Elegir de mi galería" onPress={handlePickFromGallery} />
          <CameraButton
            label="Elegir de Mis sellos"
            secondary
            onPress={() => setPickerVisible(true)}
          />
        </View>

        {fileResult.status === 'checking' && (
          <View style={styles.resultBox}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
        {fileResult.status === 'found' && (
          <>
            <Pressable
              style={[styles.resultTintBox, { borderColor: colors.success, backgroundColor: colors.surface }]}
              onPress={() => setFileDetailVisible(true)}
            >
              <Text style={[styles.matchText, { color: colors.success }]}>
                Este archivo ya está sellado. Toca para ver el certificado completo.
              </Text>
            </Pressable>
            <Pressable onPress={() => setFileResult({ status: 'idle' })}>
              <Text style={[styles.clearResultLink, { color: colors.textMuted }]}>Limpiar resultado ✕</Text>
            </Pressable>
          </>
        )}
        {fileResult.status === 'found-public' && (
          <>
            <View style={[styles.resultTintBox, { borderColor: colors.success, backgroundColor: colors.surface }]}>
              <Text style={[styles.matchText, { color: colors.success }]}>
                Este archivo ya está sellado desde otro dispositivo (no tenemos el
                archivo aquí para mostrártelo, solo confirmamos que existe).
              </Text>
              {fileResult.entry.sequenceNumber && (
                <Text style={[styles.hashLabel, { color: colors.textMuted }]}>
                  Nº de orden: {fileResult.entry.sequenceNumber}
                </Text>
              )}
              <Text style={[styles.hashLabel, { color: colors.textMuted }]}>Nivel de confianza</Text>
              <Text style={[styles.hashValue, { color: colors.text }]}>{fileResult.entry.trustLevel}</Text>
            </View>
            <Pressable onPress={() => setFileResult({ status: 'idle' })}>
              <Text style={[styles.clearResultLink, { color: colors.textMuted }]}>Limpiar resultado ✕</Text>
            </Pressable>
          </>
        )}

        {fileResult.status === 'not-found' && (
          <>
            <View style={[styles.resultTintBox, { borderColor: colors.danger, backgroundColor: colors.surface }]}>
              <Text style={[styles.noMatchText, { color: colors.danger }]}>
                No encontramos este archivo sellado en este dispositivo ni en el índice
                público. Si crees que sí existe, prueba "Por número de sello" más abajo.
              </Text>
            </View>
            <Pressable onPress={() => setFileResult({ status: 'idle' })}>
              <Text style={[styles.clearResultLink, { color: colors.textMuted }]}>Limpiar resultado ✕</Text>
            </Pressable>
          </>
        )}

        {fileResult.status === 'found' && (
          <CertificateDetailModal
            certificate={fileResult.certificate}
            certificates={certificates}
            visible={fileDetailVisible}
            onClose={() => setFileDetailVisible(false)}
          />
        )}
      </View>

      {/* ---------------- Sección 2: por número de sello ---------------- */}
      <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="key-outline" size={16} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>Por número de sello</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Escribe un número de sello (por ejemplo, uno que te haya pasado otra
          persona) para confirmar si existe de verdad.
        </Text>

        <View style={styles.inputRow}>
          {/* Android dibuja su propia línea de subrayado por defecto debajo
              de todo TextInput, que sobresalía por debajo de nuestro borde
              redondeado como una línea negra extra ("se ve horrible").
              underlineColorAndroid="transparent" no la elimina en todos los
              dispositivos, así que además la recortamos físicamente:
              overflow:'hidden' en el contenedor con el mismo borderRadius
              corta cualquier decoración nativa que sobresalga del borde. */}
          <View
            ref={sealInputRef}
            collapsable={false}
            style={[styles.inputWrapper, styles.inputFlex, { borderColor: colors.border }]}
          >
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Número de sello (0x...)"
              placeholderTextColor={colors.textMuted}
              value={sealInput}
              onChangeText={handleSealInputChange}
              autoCapitalize="none"
              underlineColorAndroid="transparent"
            />
          </View>
          {sealInput.length > 0 && (
            <Pressable
              style={[styles.clearButton, { borderColor: colors.border }]}
              onPress={() => handleSealInputChange('')}
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable style={[styles.searchButton, { backgroundColor: colors.accent }]} onPress={handleSearchBySeal}>
          <Text style={[styles.searchButtonText, { color: colors.accentText }]}>Buscar</Text>
        </Pressable>

        {hashResult.status === 'checking' && (
          <View style={styles.resultBox}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {hashResult.status === 'found-local' && (
          <View style={styles.resultBox}>
            <Text style={[styles.matchText, { color: colors.success }]}>Este sello es de tu dispositivo:</Text>
            <CertificateCard
              certificate={hashResult.certificate}
              onPress={() => setHashDetailVisible(true)}
            />
            <CertificateDetailModal
              certificate={hashResult.certificate}
              certificates={certificates}
              visible={hashDetailVisible}
              onClose={() => setHashDetailVisible(false)}
            />
          </View>
        )}

        {hashResult.status === 'found-on-chain' && (
          <View style={[styles.resultTintBox, { borderColor: colors.success, backgroundColor: colors.surface }]}>
            <Text style={[styles.matchText, { color: colors.success }]}>
              Este número de sello existe en el registro público (no es de este
              dispositivo, así que no tenemos el archivo para mostrarte).
            </Text>
            <Text style={[styles.hashLabel, { color: colors.textMuted }]}>Huella digital anclada</Text>
            <Text style={[styles.hashValue, { color: colors.text }]} selectable>
              {hashResult.sha256}
            </Text>
          </View>
        )}

        {hashResult.status === 'not-found' && (
          <View style={[styles.resultTintBox, { borderColor: colors.danger, backgroundColor: colors.surface }]}>
            <Text style={[styles.noMatchText, { color: colors.danger }]}>
              No se encontró ninguna transacción con ese número de sello.
            </Text>
          </View>
        )}
      </View>

      {/* Alguien sin la app instalada (ej. a quien le compartiste un
          certificado) también puede verificar por su cuenta — la misma
          consulta, en una página web pública (ver docs/index.html). */}
      <Pressable onPress={() => Linking.openURL('https://josequevedov08.github.io/Verity-MVP/')}>
        <Text style={[styles.webVerifyLink, { color: colors.textMuted }]}>
          ¿Quieres que alguien sin la app verifique un sello? Compárteles{' '}
          <Text style={{ color: colors.accent, fontWeight: '700' }}>
            josequevedov08.github.io/Verity-MVP
          </Text>
        </Text>
      </Pressable>
      </ScrollView>

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView style={[styles.pickerContainer, { backgroundColor: colors.background }]}>
          <Pressable onPress={() => setPickerVisible(false)} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.accent }]}>Cerrar ✕</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Elegir de Mis sellos</Text>
          <FlatList
            data={certificates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.pickerRow} onPress={() => handlePickFromHistory(item)}>
                {item.thumbnailUri && (
                  <Image source={{ uri: item.thumbnailUri }} style={styles.pickerThumbnail} />
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.pickerHash, { color: colors.text }]}>
                    {item.sha256}
                  </Text>
                  <Text style={[styles.pickerDate, { color: colors.textMuted }]}>
                    {new Date(item.anchor.anchoredAt).toLocaleString()}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                Todavía no has sellado ninguna foto ni video.
              </Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>

    {/* Hermano del SafeAreaView (no hijo) — ver nota en CoachMark.tsx. */}
    <CoachMark
        visible={showTour}
        steps={[
          {
            targetRef: byFileRef,
            title: '¿Ya sellaste esto?',
            text: 'Elige una foto o video (de tu galería o de "Mis sellos") y Verity revisa sola si coincide con algo que ya sellaste en este teléfono.',
          },
          {
            targetRef: sealInputRef,
            title: 'Comprueba cualquier sello',
            text: 'Pega aquí un número de sello (0x...) que te haya compartido alguien. Verity lo busca directo en el registro público para confirmar si es real, sin necesitar el archivo.',
          },
        ]}
        onFinish={() => {
          setShowTour(false);
          markCoachMarkSeen('verification');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  header: { position: 'relative', paddingRight: 48, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800' },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  notaryHeader: { alignItems: 'center', marginBottom: 24, paddingHorizontal: 12 },
  notarySeal: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  notaryText: { fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 13, marginBottom: 14 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  input: {
    padding: 14,
  },
  inputFlex: { flex: 1 },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  clearResultLink: { fontSize: 11.5, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  searchButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  searchButtonText: { fontWeight: '700' },
  actions: { gap: 12 },
  resultBox: { marginTop: 20 },
  resultTintBox: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  matchText: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  noMatchText: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  hashLabel: { fontSize: 12, marginTop: 8 },
  hashValue: { fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  pickerContainer: { flex: 1, padding: 24 },
  closeButton: { alignSelf: 'flex-end', marginBottom: 12 },
  closeText: { fontSize: 15, fontWeight: '600' },
  pickerRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'center' },
  pickerThumbnail: { width: 56, height: 56, borderRadius: 10 },
  pickerHash: { fontSize: 12, fontFamily: 'monospace' },
  pickerDate: { fontSize: 12, marginTop: 2 },
  empty: { marginTop: 40, textAlign: 'center' },
  webVerifyLink: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4 },
});
