/**
 * SealPlaceholder.tsx
 * ---------------------------------------------------------------------------
 * El "estampilla" que se muestra cuando NO hay foto/video local que
 * mostrar (ej. un certificado restaurado desde una copia de seguridad,
 * que por diseño nunca incluye el archivo — ver CertificatesBackup en
 * verity-protocol.ts). Antes esto era un ícono flotando en un fondo
 * pálido con tinte al 10% — en el nivel BAJO (gris) eso era casi
 * invisible en modo claro (se veía como "un puntico"). Ahora es un
 * relleno SÓLIDO al 100% del color de nivel de confianza (no un tinte
 * suave), con un ícono grande en blanco y la marca Verity — pensado
 * para leerse como una estampilla postal de verdad: bloque de color
 * lleno, ilustración simple, texto de marca arriba, valor abajo.
 *
 * Da 6 variantes distintas (3 niveles × foto/video).
 *
 * Nota honesta: esto es una ilustración hecha con Views + íconos de
 * React Native, no un archivo de imagen/arte ilustrado a mano o
 * generado. Si más adelante se quiere arte real (como las estampillas
 * vintage de referencia), esta es la única pieza a reemplazar — el
 * resto de la app ya recibe el tamaño/forma que necesite.
 */
import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

const TRUST_LABEL: Record<VerityCertificate['trustLevel'], string> = {
  ALTO: 'ALTA',
  MEDIO: 'MEDIA',
  BAJO: 'BAJA',
};

// Color fijo (no depende del tema) para BAJO: colors.tabBarInactive es
// deliberadamente pálido en modo claro (pensado para un ícono de tab
// inactivo, no para ser el color sólido de toda una ilustración) — a
// pantalla completa se leía casi invisible. Un gris medio fijo se ve
// bien como relleno sólido en claro Y oscuro.
const BAJO_COLOR = '#71717A';

export default function SealPlaceholder({
  mediaType,
  trustLevel,
  style,
  /** Tamaño base que escala todo lo demás — pensado para el ancho/alto
   * real del contenedor (72 en una tarjeta de lista, ~110 en una
   * grilla, mucho más grande en el reverso de la carta). */
  size = 72,
  /** Solo hay espacio para el texto de nivel ("ALTA"/"MEDIA"/"BAJA")
   * en contenedores grandes (reverso de la carta) — en miniaturas
   * chicas se omite para no verse apretado/ilegible. */
  showLabel = false,
}: {
  mediaType?: 'image' | 'video';
  trustLevel?: VerityCertificate['trustLevel'];
  style?: StyleProp<ViewStyle>;
  size?: number;
  showLabel?: boolean;
}) {
  const { colors } = useTheme();
  const trust = trustLevel ?? 'BAJO';
  const trustColor = trust === 'ALTO' ? colors.success : trust === 'MEDIO' ? colors.warning : BAJO_COLOR;
  const iconName = mediaType === 'video' ? 'videocam' : 'image';
  const iconSize = Math.round(size * 0.4);
  const wordmarkSize = Math.max(7, Math.round(size * 0.09));
  const chipTextSize = Math.max(8, Math.round(size * 0.1));
  const showWordmark = size >= 40;

  return (
    // Margen claro alrededor (simula el papel blanco de una estampilla
    // real) — el color solo vive en el bloque interior.
    <View style={[style, styles.margin, { backgroundColor: colors.surfaceAlt }]}>
      <View
        style={[
          styles.stamp,
          {
            backgroundColor: trustColor,
            borderColor: colors.surfaceAlt,
            borderWidth: Math.max(2, size * 0.035),
          },
        ]}
      >
        {showWordmark && (
          <Text style={[styles.wordmark, { fontSize: wordmarkSize }]} numberOfLines={1}>
            VERITY
          </Text>
        )}
        <Ionicons name={iconName} size={iconSize} color="rgba(255,255,255,0.95)" />
        {showLabel && (
          <View style={styles.chip}>
            <Text style={[styles.chipText, { fontSize: chipTextSize }]}>{TRUST_LABEL[trust]}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  margin: { alignItems: 'center', justifyContent: 'center', padding: '6%' },
  stamp: {
    flex: 1,
    width: '100%',
    // El borde punteado en el mismo color que el margen, sobre el
    // relleno sólido, simula la perforación de una estampilla real.
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wordmark: { color: 'rgba(255,255,255,0.85)', fontWeight: '800', letterSpacing: 1.2 },
  chip: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chipText: { color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
});
