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
import { Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';

interface CameraButtonProps {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  /** Ícono opcional a la izquierda del texto — útil cuando dos botones
   * secundarios comparten una fila y hay menos espacio para leer el
   * texto completo (ej. "Grabar video" / "Galería"). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Permite que el llamador controle el layout (ej. flex:1 dentro de
   * una fila de dos botones), sin tocar el estilo base del botón. */
  style?: StyleProp<ViewStyle>;
}

export default function CameraButton({ label, onPress, secondary, icon, style }: CameraButtonProps) {
  const { colors } = useTheme();
  const textColor = secondary ? colors.accent : colors.accentText;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        secondary
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.accent }
          : { backgroundColor: colors.accent },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={textColor} />}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
});
