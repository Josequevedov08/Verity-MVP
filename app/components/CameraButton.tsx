/**
 * CameraButton.tsx
 * ---------------------------------------------------------------------------
 * Botón grande y simple, reutilizado para "Tomar foto" y "Elegir de galería".
 * Mantenerlo sin jerga técnica: el usuario nunca ve las palabras "hash" ni
 * "blockchain" en esta pantalla, solo acciones claras.
 */
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

interface CameraButtonProps {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}

export default function CameraButton({ label, onPress, secondary }: CameraButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, secondary && styles.secondaryButton]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1a73e8',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#eef2f7',
  },
  label: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryLabel: {
    color: '#1a73e8',
  },
});
