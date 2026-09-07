/**
 * SealStamp.tsx
 * ---------------------------------------------------------------------------
 * El sello literal: un círculo tipo "sello de tinta" (doble anillo, texto
 * "GENUINO · VERITY", inclinado) que aterriza con un golpe sobre la
 * esquina de la tarjeta recién sellada, con un pequeño delay respecto a
 * StampReveal (que anima la caída de toda la tarjeta) — así se siente
 * como si el sello golpeara DESPUÉS de que el documento ya aterrizó, no
 * al mismo tiempo.
 *
 * No dice "confianza" a propósito — eso ya lo dice la insignia de arriba
 * (TrustLevelBadge). Este sello certifica autenticidad/origen ("esto es
 * un sello genuino de Verity"), no el nivel de confianza del contenido.
 *
 * `trigger` debe cambiar cada vez que se quiere repetir la animación (ej.
 * el id del certificado nuevo).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';

const STAMP_DELAY_MS = 550;

export default function SealStamp({ trigger }: { trigger: string | number }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(2.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current; // 0 = -18deg, 1 = -12deg (asienta un poco)

  useEffect(() => {
    scale.setValue(2.4);
    opacity.setValue(0);
    rotate.setValue(0);

    const timer = setTimeout(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch {
        // los hápticos nunca deben tumbar la animación
      }
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.spring(rotate, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]).start();
    }, STAMP_DELAY_MS);

    return () => clearTimeout(timer);
  }, [trigger]);

  const rotateInterpolated = rotate.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '-12deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ scale }, { rotate: rotateInterpolated }],
        },
      ]}
    >
      <View style={[styles.ringOuter, { borderColor: colors.accent }]}>
        <View style={[styles.ringInner, { borderColor: colors.accent }]}>
          <Text style={[styles.textTop, { color: colors.accent }]}>GENUINO</Text>
          <Text style={[styles.textBottom, { color: colors.accent }]}>VERITY</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: -14,
    right: -10,
  },
  ringOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textTop: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  textBottom: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginTop: 1 },
});
