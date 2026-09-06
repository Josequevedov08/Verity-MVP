/**
 * SettingsButton.tsx
 * ---------------------------------------------------------------------------
 * Ícono de engranaje que abre el selector de apariencia (SettingsModal).
 * Se coloca en la esquina superior derecha de las 3 pantallas principales.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
// Import directo al submódulo (no desde el paquete raíz): el barrel de
// @expo/vector-icons carga las 15 familias de íconos de una sola vez
// (~3MB de fuentes), incluso "solo" para usar Ionicons. Esto hacía que
// la app tardara mucho en transferirse al teléfono por Metro,
// especialmente con señal móvil débil.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import SettingsModal from './SettingsModal';

export default function SettingsButton() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        style={[styles.button, { backgroundColor: colors.surfaceAlt }]}
        onPress={() => setVisible(true)}
        hitSlop={8}
      >
        <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
      </Pressable>
      <SettingsModal visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
