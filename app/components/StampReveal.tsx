/**
 * StampReveal.tsx
 * ---------------------------------------------------------------------------
 * Envuelve el certificado recién completado con una animación de "golpe
 * de sello": cae desde arriba, grande y rotado, y aterriza con un rebote
 * en su tamaño normal — más un destello circular detrás (como una onda
 * de impacto) y una vibración en el instante del golpe. Es el momento
 * más importante de toda la app.
 *
 * `trigger` debe cambiar cada vez que se quiere repetir la animación
 * (ej. el id del certificado nuevo).
 *
 * Nota: la primera versión de esta animación era demasiado sutil/rápida
 * (~300ms, spring muy rígido) — en la práctica pasaba desapercibida.
 * Esta versión dura ~900ms con un rebote visible y un destello de color,
 * para que sea imposible no notarla.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';

export default function StampReveal({
  children,
  trigger,
}: {
  children: React.ReactNode;
  trigger: string | number;
}) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(2)).current;
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(1)).current; // 1 = -10deg, 0 = 0deg
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(2);
    translateY.setValue(-60);
    opacity.setValue(0);
    rotate.setValue(1);
    flash.setValue(0);

    // La vibración nunca debe poder tumbar la animación: si el
    // dispositivo no soporta hápticos, esto debe fallar en silencio.
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } catch {
      // ignorado a propósito
    }

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 4,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 45, useNativeDriver: true }),
        Animated.spring(rotate, { toValue: 0, friction: 4, tension: 45, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 450, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [trigger]);

  const rotateInterpolated = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-10deg'],
  });
  const flashScale = flash.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] });

  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flash,
          {
            backgroundColor: colors.accent,
            opacity: flash,
            transform: [{ scale: flashScale }],
          },
        ]}
      />
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }, { scale }, { rotate: rotateInterpolated }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flash: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    right: '10%',
    bottom: '15%',
    borderRadius: 24,
  },
});
