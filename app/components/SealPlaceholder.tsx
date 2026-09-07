/**
 * SealPlaceholder.tsx
 * ---------------------------------------------------------------------------
 * El "estampilla" que se muestra cuando NO hay foto/video local que
 * mostrar (ej. un certificado restaurado desde una copia de seguridad,
 * que por diseño nunca incluye el archivo — ver CertificatesBackup en
 * verity-protocol.ts). Antes esto era un ícono plano flotando en un
 * cuadro gris, que de lejos se sentía como "se perdió todo" — la idea
 * ahora es que SIEMPRE haya algo que mirar, con estilo de estampilla
 * postal (borde perforado, color según nivel de confianza), para que
 * importar un historial viejo se sienta "estos sellos siguen siendo
 * válidos", no "esto se rompió".
 *
 * Nota honesta: esto es una ilustración vectorial hecha con Views de
 * React Native (borde punteado + ícono + texto), no un archivo de
 * imagen/arte real. Da 6 variantes distintas (3 niveles × foto/video)
 * sin necesitar assets de diseño — si más adelante se quiere arte
 * ilustrado de verdad (dibujado o generado), esta es la pieza a
 * reemplazar; el resto de la app ya está preparado para eso (solo
 * cambiaría este componente).
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

export default function SealPlaceholder({
  mediaType,
  trustLevel,
  style,
  /** Tamaño base que escala ícono y grosor del borde — pensado para el
   * ancho/alto real del contenedor (72 en una tarjeta de lista, ~110 en
   * una grilla, mucho más grande en el reverso de la carta). */
  size = 72,
  /** Solo hay espacio para el texto "SELLO · ALTA" en contenedores
   * grandes (reverso de la carta) — en miniaturas chicas se omite. */
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
  const trustColor = trust === 'ALTO' ? colors.success : trust === 'MEDIO' ? colors.warning : colors.tabBarInactive;
  const iconName = mediaType === 'video' ? 'videocam' : 'image';
  const iconSize = Math.round(size * 0.32);
  const labelSize = Math.max(9, Math.round(size * 0.075));

  return (
    <View style={[style, styles.outer, { backgroundColor: colors.surfaceAlt }]}>
      <View
        style={[
          styles.stamp,
          {
            borderColor: trustColor,
            backgroundColor: `${trustColor}1A`,
            borderWidth: Math.max(1.5, size * 0.02),
          },
        ]}
      >
        <Ionicons name={iconName} size={iconSize} color={trustColor} />
        {showLabel && (
          <>
            <View style={[styles.labelDivider, { borderColor: trustColor }]} />
            <Text style={[styles.label, { color: trustColor, fontSize: labelSize }]}>
              SELLO · {TRUST_LABEL[trust]}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center', padding: '8%' },
  stamp: {
    flex: 1,
    width: '100%',
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  labelDivider: { width: '40%', borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
  label: { fontWeight: '800', letterSpacing: 0.6 },
});
