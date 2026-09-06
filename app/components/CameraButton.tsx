/**
 * CameraButton.tsx
 * ---------------------------------------------------------------------------
 * Botón grande y simple, reutilizado para "Tomar foto" y "Elegir de galería".
 * Mantenerlo sin jerga técnica: el usuario nunca ve las palabras "hash" ni
 * "blockchain" en esta pantalla, solo acciones claras.
 */
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface CameraButtonProps {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}

export default function CameraButton({ label, onPress, secondary }: CameraButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: secondary ? colors.surfaceAlt : colors.accent },
      ]}
    >
      <Text style={[styles.label, { color: secondary ? colors.accent : colors.accentText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
  },
});
