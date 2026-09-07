/**
 * SealMedallion.tsx
 * ---------------------------------------------------------------------------
 * El sello circular que se muestra cuando NO hay foto/video local que
 * mostrar (ej. un certificado restaurado desde una copia de seguridad,
 * que por diseño nunca incluye el archivo — ver CertificatesBackup en
 * verity-protocol.ts). NO es una imagen del contenido — a propósito:
 * certifica que el hash es genuino y está validado por Verity, sin
 * poder confundirse con la foto/video real.
 *
 * Este diseño es un port de la GEOMETRÍA (misma forma: borde festoneado,
 * anillos, texto curvo, monograma) del mockup HTML/SVG que el usuario
 * diseñó y aprobó por fuera de la app (gemini-code-1788800624188.html).
 * Los colores de esa maqueta eran solo de prueba (el usuario los puso
 * "de base" para ver la forma) — el color real usado aquí es el mismo
 * token de nivel de confianza que ya usa el resto de la app (TrustPill,
 * TrustLevelBadge, insignias de la grilla): colors.success/warning/
 * tabBarInactive, no valores fijos.
 */
import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath, G } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

export default function SealMedallion({
  trustLevel,
  style,
  /** Tamaño del contenedor cuadrado que centra el sello (72 en una
   * tarjeta de lista, ~110 en una grilla, mucho más grande en el
   * reverso de la carta). */
  size = 72,
}: {
  trustLevel?: VerityCertificate['trustLevel'];
  style?: StyleProp<ViewStyle>;
  size?: number;
}) {
  const { colors } = useTheme();
  const trust = trustLevel ?? 'BAJO';
  const color = trust === 'ALTO' ? colors.success : trust === 'MEDIO' ? colors.warning : colors.tabBarInactive;

  return (
    <View style={[style, styles.wrap]}>
      <Svg width={size} height={size} viewBox="0 0 500 500">
        <Defs>
          <Path id="textPathTop" d="M 110,250 A 140,140 0 0,1 390,250" />
          <Path id="textPathBottom" d="M 400,250 A 150,150 0 0,1 100,250" />
        </Defs>

        {/* Borde festoneado: stroke-dasharray "0,35.78" + linecap redondo
            dibuja una fila de puntos (no rayas) — el efecto de moneda. */}
        <Circle
          cx={250}
          cy={250}
          r={205}
          fill="none"
          stroke={color}
          strokeWidth={26}
          strokeLinecap="round"
          strokeDasharray="0,35.7792"
        />
        <Circle cx={250} cy={250} r={205} fill={color} />

        <Circle cx={250} cy={250} r={185} fill="none" stroke="#ffffff" strokeWidth={1.5} opacity={0.6} />
        <Circle
          cx={250}
          cy={250}
          r={175}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1}
          strokeDasharray="6,4"
          opacity={0.9}
        />
        <Circle cx={250} cy={250} r={115} fill="none" stroke="#ffffff" strokeWidth={2.5} />

        <SvgText fill="#ffffff" fontSize={18} fontWeight="900" letterSpacing={3.5}>
          <TextPath href="#textPathTop" startOffset="50%" textAnchor="middle">
            VERITY SECURE CERTIFICATION
          </TextPath>
        </SvgText>
        <SvgText fill="#ffffff" fontSize={18} fontWeight="900" letterSpacing={3}>
          <TextPath href="#textPathBottom" startOffset="50%" textAnchor="middle">
            TRUSTED DIGITAL ASSET
          </TextPath>
        </SvgText>

        <G transform="translate(250, 250)">
          <SvgText x={0} y={15} fill="#ffffff" fontSize={75} fontWeight="900" textAnchor="middle" letterSpacing={2}>
            VRT
          </SvgText>
          <SvgText
            x={0}
            y={45}
            fill="#ffffff"
            fontSize={15}
            fontWeight="900"
            textAnchor="middle"
            letterSpacing={7}
            opacity={0.95}
          >
            VERITY
          </SvgText>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
