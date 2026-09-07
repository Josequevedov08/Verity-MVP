/**
 * SettingsModal.tsx
 * ---------------------------------------------------------------------------
 * Panel de ajustes: selector de apariencia (Claro/Oscuro/Sistema) +
 * sección "Acerca de Verity" con versión, red y la wallet del
 * dispositivo (copiable) + "Legal y ayuda".
 *
 * Antes era una hoja inferior (bottom sheet) que solo tapaba parte de
 * la pantalla — se sentía como si "se abriera desde abajo" mostrando
 * parte de la pantalla anterior detrás, y al vivir dentro de un
 * ScrollView anidado en un Pressable de fondo, el gesto de deslizar
 * para hacer scroll a veces no se registraba bien (competía con el
 * Pressable del backdrop). Ahora es una pantalla completa propia,
 * igual que CertificateDetailModal/LegalContentModal — más predecible
 * para hacer scroll y visualmente consistente con el resto de la app.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Import directo al submódulo (ver SettingsButton.tsx para el porqué:
// el barrel de @expo/vector-icons carga las 15 familias de íconos de
// una sola vez, ~3MB de fuentes de más).
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useTheme, type ThemePreference } from '../theme/ThemeContext';
import {
  getDeviceWalletAddress,
  exportDeviceWalletPrivateKey,
  restoreDeviceWalletFromPrivateKey,
} from '../services/blockchainService';
import { resetAllCoachMarks } from '../utils/coachMarkUtils';
import LegalContentModal, { LEGAL_DOCS, type LegalDocId } from './LegalContentModal';

const APP_ICON = require('../../assets/icons/app-icon.png');
// Mantener en sync con la versión de package.json / app.json.
const APP_VERSION = '0.1.0';

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Oscuro', icon: 'moon-outline' },
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
];

export default function SettingsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, preference, setPreference } = useTheme();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [openDoc, setOpenDoc] = useState<LegalDocId | null>(null);

  /**
   * Antes esto solo reiniciaba una bandera en AsyncStorage sin ningún
   * efecto visible inmediato — la pestaña donde estabas (ej. Sellar)
   * ya estaba montada de antes y no volvía a revisar su propio estado
   * solo porque el dato cambió. resetAllCoachMarks ahora también avisa
   * en memoria a las pantallas ya montadas (ver
   * useCoachMarkResetVersion), y aquí cerramos Ajustes de inmediato:
   * al volver a la pantalla de siempre, su recorrido ya aparece solo,
   * sin tener que salir y re-entrar a la pestaña.
   */
  async function handleReplayTour() {
    await resetAllCoachMarks();
    onClose();
  }

  useEffect(() => {
    if (visible && !walletAddress) {
      getDeviceWalletAddress().then(setWalletAddress).catch(() => {});
    }
  }, [visible]);

  async function handleCopyWallet() {
    if (!walletAddress) return;
    await Clipboard.setStringAsync(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  /**
   * Sin esto, si el usuario borra los datos de la app o cambia de
   * teléfono, pierde para siempre la identidad con la que selló antes
   * (ya le pasó una vez en pruebas reales — ver blockchainService.ts).
   * El archivo generado contiene la clave privada en texto plano: tan
   * sensible como una contraseña, de ahí la advertencia explícita antes
   * de generarlo.
   */
  async function handleBackupWallet() {
    Alert.alert(
      'Respaldar tu wallet',
      'Se va a generar un archivo con la clave de tu wallet. Guárdalo en un lugar seguro y NUNCA lo compartas — quien lo tenga puede sellar como si fuera este teléfono. Es la única forma de recuperar tu identidad si pierdes el teléfono o borras los datos de la app.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: async () => {
            try {
              const privateKey = await exportDeviceWalletPrivateKey();
              const address = walletAddress ?? (await getDeviceWalletAddress());
              const backup = {
                version: 1,
                walletAddress: address,
                privateKey,
                exportedAt: new Date().toISOString(),
              };

              const file = new File(Paths.cache, `verity-wallet-backup-${Date.now()}.json`);
              if (!file.exists) file.create({ intermediates: true });
              file.write(JSON.stringify(backup, null, 2));

              const canShare = await Sharing.isAvailableAsync();
              if (!canShare) {
                Alert.alert('No disponible', 'Compartir archivos no está disponible en este dispositivo.');
                return;
              }
              await Sharing.shareAsync(file.uri, {
                mimeType: 'application/json',
                dialogTitle: 'Guardar respaldo de tu wallet',
              });
            } catch (error) {
              console.error('Error al respaldar la wallet:', error);
              Alert.alert('Error', 'No se pudo generar el respaldo.');
            }
          },
        },
      ]
    );
  }

  /** Reemplaza la wallet de este teléfono por la de un respaldo — para
   * cuando alguien cambió de teléfono y quiere recuperar la identidad
   * con la que ya había sellado antes. */
  async function handleRestoreWallet() {
    Alert.alert(
      'Restaurar wallet desde respaldo',
      'Esto reemplaza la wallet de este teléfono por la del archivo que elijas. Solo hazlo si sabes lo que contiene el archivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Elegir archivo',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });
              if (result.canceled || !result.assets[0]) return;

              // fetch() en vez de la clase File nueva: más robusto con
              // las rutas que entrega el selector de documentos (mismo
              // motivo que en CertificatesScreen.handleImport).
              const text = await fetch(result.assets[0].uri).then((res) => res.text());
              const backup = JSON.parse(text) as { privateKey?: string };

              if (!backup?.privateKey) {
                Alert.alert('Archivo inválido', 'Este archivo no parece ser un respaldo de wallet de Verity.');
                return;
              }

              const address = await restoreDeviceWalletFromPrivateKey(backup.privateKey);
              setWalletAddress(address);
              Alert.alert('Wallet restaurada', `Este teléfono ahora usa la wallet ${truncateAddress(address)}.`);
            } catch (error) {
              console.error('Error al restaurar la wallet:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo restaurar la wallet.');
            }
          },
        },
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.page, { backgroundColor: colors.surface }]}>
        <View style={styles.topBar}>
          <Text style={[styles.title, { color: colors.text }]}>Ajustes</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.closeText, { color: colors.accent }]}>Cerrar ✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>APARIENCIA</Text>
            <View style={{ gap: 10 }}>
              {OPTIONS.map((option) => {
                const selected = preference === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.option,
                      { borderColor: colors.border },
                      selected && { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
                    ]}
                    onPress={() => setPreference(option.value)}
                  >
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={selected ? colors.accent : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: selected ? colors.accent : colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.accent} style={{ marginLeft: 'auto' }} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              ACERCA DE VERITY
            </Text>
            <View style={[styles.aboutCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.aboutHeader}>
                <Image source={APP_ICON} style={styles.aboutIcon} />
                <View>
                  <Text style={[styles.aboutTitle, { color: colors.text }]}>Verity</Text>
                  <Text style={[styles.aboutVersion, { color: colors.textMuted }]}>
                    Versión {APP_VERSION} · MVP Shipaton 2026
                  </Text>
                </View>
              </View>
              <Text style={[styles.aboutTagline, { color: colors.textMuted }]}>
                Notario digital para tus fotos: huella digital SHA-256 calculada
                en tu teléfono y registrada en un registro público, sin subir
                el archivo a ningún lado.
              </Text>

              {/* Las dos filas usan una columna de etiqueta de ancho FIJO
                  (styles.aboutRowLabel) para que el valor siempre empiece
                  en la misma X, sin importar si la etiqueta es "Red" o
                  "Wallet del dispositivo" — antes cada valor se alineaba
                  a la derecha por separado, así que "0x086e..." y
                  "Polygon Amoy" no empezaban en la misma columna. */}
              <View style={[styles.aboutRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.aboutRowLabel, { color: colors.textMuted }]}>Red</Text>
                <Text style={[styles.aboutRowValue, { color: colors.text }]}>Polygon Amoy (testnet)</Text>
              </View>

              <Pressable
                style={[styles.aboutRow, { borderTopColor: colors.border }]}
                onPress={handleCopyWallet}
              >
                <Text style={[styles.aboutRowLabel, { color: colors.textMuted }]}>
                  Wallet del dispositivo
                </Text>
                <View style={styles.aboutRowValueWrap}>
                  <Text style={[styles.aboutRowValue, { color: colors.text, fontFamily: 'monospace' }]}>
                    {walletAddress ? truncateAddress(walletAddress) : '...'}
                  </Text>
                  <Ionicons
                    name={copied ? 'checkmark-circle' : 'copy-outline'}
                    size={15}
                    color={copied ? colors.success : colors.accent}
                  />
                </View>
              </Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              RESPALDO DE LA WALLET
            </Text>
            <Text style={[styles.walletHint, { color: colors.textMuted }]}>
              Si borras los datos de la app o cambias de teléfono, se pierde la wallet y con ella
              la posibilidad de sellar con esta misma identidad. Un respaldo es la única forma de
              recuperarla.
            </Text>
            <View style={[styles.aboutCard, { backgroundColor: colors.background, borderColor: colors.border, padding: 4 }]}>
              <Pressable style={styles.legalRow} onPress={handleBackupWallet}>
                <Text style={[styles.legalRowLabel, { color: colors.text }]}>Respaldar mi wallet</Text>
                <Ionicons name="download-outline" size={18} color={colors.textMuted} />
              </Pressable>
              <Pressable
                style={[styles.legalRow, { borderTopWidth: 1, borderTopColor: colors.border }]}
                onPress={handleRestoreWallet}
              >
                <Text style={[styles.legalRowLabel, { color: colors.text }]}>Restaurar desde respaldo</Text>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              LEGAL Y AYUDA
            </Text>
            <View style={[styles.aboutCard, { backgroundColor: colors.background, borderColor: colors.border, padding: 4 }]}>
              {(Object.keys(LEGAL_DOCS) as LegalDocId[]).map((id, index) => (
                <Pressable
                  key={id}
                  style={[
                    styles.legalRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                  onPress={() => setOpenDoc(id)}
                >
                  <Text style={[styles.legalRowLabel, { color: colors.text }]}>{LEGAL_DOCS[id].title}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.replayTourButton} onPress={handleReplayTour}>
              <Ionicons name="play-circle-outline" size={16} color={colors.accent} />
              <Text style={[styles.replayTourText, { color: colors.accent }]}>Ver la guía de nuevo</Text>
            </Pressable>

        </ScrollView>
      </SafeAreaView>

      <LegalContentModal docId={openDoc} onClose={() => setOpenDoc(null)} />
    </Modal>
  );
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800' },
  closeText: { fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  subtitle: { fontSize: 13, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  aboutCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  aboutIcon: { width: 44, height: 44, borderRadius: 12 },
  aboutTitle: { fontSize: 16, fontWeight: '800' },
  aboutVersion: { fontSize: 11, marginTop: 2 },
  aboutTagline: { fontSize: 12.5, lineHeight: 18 },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  // Ancho fijo: así el valor de CUALQUIER fila empieza siempre en la
  // misma columna, sin importar cuánto mida el texto de la etiqueta.
  aboutRowLabel: { fontSize: 12.5, fontWeight: '600', width: 128 },
  aboutRowValue: { fontSize: 12.5 },
  aboutRowValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  legalRowLabel: { fontSize: 13.5, fontWeight: '600' },
  walletHint: { fontSize: 11.5, lineHeight: 16, marginBottom: 10 },
  replayTourButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  replayTourText: { fontSize: 13, fontWeight: '700' },
});
