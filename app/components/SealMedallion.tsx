/**
 * SealMedallion.tsx
 * ---------------------------------------------------------------------------
 * El sello circular que se muestra cuando NO hay foto/video local que
 * mostrar (ej. un certificado restaurado desde una copia de seguridad,
 * que por diseño nunca incluye el archivo — ver CertificatesBackup en
 * verity-protocol.ts). Es una medalla/estampilla de verdad — borde
 * dentado, anillo de texto curvo "VERITY SECURE CERTIFICATION" /
 * "TRUSTED DIGITAL ASSET", monograma "V" al centro, insignia de check
 * superpuesta — NO una foto/video de lo verificado (a propósito: esta
 * imagen certifica que el hash es genuino y está validado por Verity,
 * nunca debe poder confundirse con el contenido real sellado).
 *
 * 3 colores según nivel de confianza × mismo diseño para foto/video
 * (un pequeño ícono de cámara en la esquina distingue video).
 *
 * Hecho con react-native-svg (necesario para el texto curvo — no es
 * posible con Views planas de RN). Las dos curvas de texto usan un
 * <Path> invisible como guía (<TextPath>): el arco de ARRIBA es el
 * arco MAYOR (large-arc=1) recorrido en sentido horario desde la
 * izquierda; el de ABAJO es el arco MENOR (large-arc=0) recorrido
 * también en sentido horario desde la izquierda — ambos con el mismo
 * sentido de recorrido para que el texto de abajo no salga al revés
 * (el error clásico de "texto invertido" al poner texto en la mitad
 * inferior de un círculo).
 */
import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

// Gris fijo (no depende del tema) para BAJO: el tono de tema equivalente
// es demasiado pálido en modo claro para un relleno sólido a pantalla
// completa (casi invisible — bug real reportado antes).
const BAJO_COLOR = '#71717A';

export default function SealMedallion({
  mediaType,
  trustLevel,
  style,
  /** Tamaño del contenedor cuadrado que centra la medalla (72 en una
   * tarjeta de lista, ~110 en una grilla, mucho más grande en el
   * reverso de la carta). La medalla en sí ocupa ~88% de esto. */
  size = 72,
}: {
  mediaType?: 'image' | 'video';
  trustLevel?: VerityCertificate['trustLevel'];
  style?: StyleProp<ViewStyle>;
  size?: number;
}) {
  const { colors } = useTheme();
  const trust = trustLevel ?? 'BAJO';
  const color = trust === 'ALTO' ? colors.success : trust === 'MEDIO' ? colors.warning : BAJO_COLOR;
  const diameter = Math.round(size * 0.88);
  const badgeSize = Math.max(14, Math.round(size * 0.22));

  return (
    <View style={[style, styles.wrap, { backgroundColor: colors.surfaceAlt }]}>
      <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
        <Defs>
          {/* Arco de arriba: mayor, horario, empieza a la izquierda. */}
          <Path id="topArc" d="M 14 62 A 38 38 0 1 1 86 62" fill="none" />
          {/* Arco de abajo: menor, horario, empieza a la izquierda —
              mismo sentido que el de arriba para que el texto no salga
              invertido. */}
          <Path id="bottomArc" d="M 15.5 66 A 38 38 0 0 1 84.5 66" fill="none" />
        </Defs>

        {/* Borde dentado (like una moneda/estampilla real). */}
        <Circle cx={50} cy={50} r={47} fill="none" stroke={color} strokeWidth={5} strokeDasharray="2.6,2.1" />
        {/* Cara sólida de la medalla. */}
        <Circle cx={50} cy={50} r={41} fill={color} />
        {/* Anillo interior fino que separa el texto del monograma. */}
        <Circle cx={50} cy={50} r={33.5} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1} />

        <SvgText fontSize={6.4} fontWeight="bold" letterSpacing={0.6} fill="#fff">
          <TextPath href="#topArc" startOffset="50%" textAnchor="middle">
            VERITY SECURE CERTIFICATION
          </TextPath>
        </SvgText>
        <SvgText fontSize={5.6} fontWeight="bold" letterSpacing={0.5} fill="rgba(255,255,255,0.85)">
          <TextPath href="#bottomArc" startOffset="50%" textAnchor="middle">
            TRUSTED DIGITAL ASSET
          </TextPath>
        </SvgText>

        <SvgText x={50} y={59} fontSize={28} fontWeight="bold" fill="#fff" textAnchor="middle">
          V
        </SvgText>
      </Svg>

      {/* Insignia de verificación superpuesta, siempre verde (es una
          señal fija de "autenticidad confirmada", independiente del
          color de nivel de confianza de la medalla). */}
      <View
        style={[
          styles.checkBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: colors.success,
            borderColor: colors.surfaceAlt,
          },
        ]}
      >
        <Ionicons name="checkmark" size={Math.round(badgeSize * 0.65)} color="#fff" />
      </View>

      {mediaType === 'video' && (
        <View style={[styles.videoBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <Ionicons name="videocam" size={Math.max(10, Math.round(size * 0.16))} color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  checkBadge: {
    position: 'absolute',
    bottom: '6%',
    right: '6%',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
