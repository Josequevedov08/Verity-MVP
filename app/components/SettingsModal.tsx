/**
 * SettingsModal.tsx
 * ---------------------------------------------------------------------------
 * Panel de ajustes: selector de apariencia (Claro/Oscuro/Sistema) +
 * sección "Acerca de Verity" con versión, red y la wallet del
 * dispositivo (copiable). Antes solo tenía el selector de tema y se
 * sentía vacío/poco interactivo.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Image, ScrollView } from 'react-native';
// Import directo al submódulo (ver SettingsButton.tsx para el porqué:
// el barrel de @expo/vector-icons carga las 15 familias de íconos de
// una sola vez, ~3MB de fuentes de más).
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useTheme, type ThemePreference } from '../theme/ThemeContext';
import { getDeviceWalletAddress } from '../services/blockchainService';

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

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: colors.text }]}>Ajustes</Text>

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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Listo</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
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
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  aboutRowLabel: { fontSize: 12.5, fontWeight: '600' },
  aboutRowValue: { fontSize: 12.5 },
  closeButton: { alignItems: 'center', paddingVertical: 16, marginTop: 20 },
});
