/**
 * SettingsModal.tsx
 * ---------------------------------------------------------------------------
 * Selector de apariencia: Claro / Oscuro / Sistema. Se abre desde el
 * ícono de engranaje que aparece en las 3 pantallas principales (ver
 * SettingsButton.tsx).
 */
import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
// Import directo al submódulo (ver SettingsButton.tsx para el porqué:
// el barrel de @expo/vector-icons carga las 15 familias de íconos de
// una sola vez, ~3MB de fuentes de más).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, type ThemePreference } from '../theme/ThemeContext';

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

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>Apariencia</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Elige cómo se ve Verity en tu teléfono.
          </Text>

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

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Listo</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700' },
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
  closeButton: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
});
