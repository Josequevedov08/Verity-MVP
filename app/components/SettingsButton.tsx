/**
 * SettingsButton.tsx
 * ---------------------------------------------------------------------------
 * Ícono de engranaje que abre el panel de ajustes (SettingsModal). Por
 * defecto flota en la esquina superior derecha (uso en Sellar/Verificar);
 * con `inline` se comporta como un botón normal dentro de una fila, para
 * cuando comparte espacio con otro ícono (ej. Mis sellos, junto al
 * selector de lista/grilla).
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

export default function SettingsButton({ inline }: { inline?: boolean }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        style={[
          styles.button,
          { backgroundColor: colors.surfaceAlt },
          !inline && styles.floating,
        ]}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: { position: 'absolute', top: 0, right: 0 },
});
