/**
 * CameraButton.tsx
 * ---------------------------------------------------------------------------
 * Botón grande y simple, reutilizado para "Tomar foto" y "Elegir de galería".
 * Mantenerlo sin jerga técnica: el usuario nunca ve las palabras "hash" ni
 * "blockchain" en esta pantalla, solo acciones claras.
 *
 * Jerarquía visual consistente con el resto de la app: primario = relleno
 * sólido de acento; secundario = contorno (mismo lenguaje que las
 * pastillas de estado del certificado), no un relleno gris plano.
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
        secondary
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.accent }
          : { backgroundColor: colors.accent },
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
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
});
