/**
 * StampReveal.tsx
 * ---------------------------------------------------------------------------
 * Envuelve el certificado recién completado con una animación de "golpe
 * de sello": entra grande y algo rotado, y cae de golpe (spring) a su
 * tamaño normal, con una vibración suave en el instante del impacto. Es
 * el momento más importante de toda la app — antes simplemente aparecía
 * sin ninguna transición.
 *
 * `trigger` debe cambiar cada vez que se quiere repetir la animación
 * (ej. el id del certificado nuevo) — si no cambia, no se re-dispara.
 */
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function StampReveal({
  children,
  trigger,
}: {
  children: React.ReactNode;
  trigger: string | number;
}) {
  const scale = useRef(new Animated.Value(1.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(1)).current; // 1 = -6deg, 0 = 0deg

  useEffect(() => {
    scale.setValue(1.6);
    opacity.setValue(0);
    rotate.setValue(1);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.spring(rotate, { toValue: 0, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [trigger]);

  const rotateInterpolated = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-6deg'],
  });

  return (
    <Animated.View style={{ opacity, transform: [{ scale }, { rotate: rotateInterpolated }] }}>
      {children}
    </Animated.View>
  );
}
