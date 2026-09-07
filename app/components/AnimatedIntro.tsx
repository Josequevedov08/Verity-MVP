/**
 * AnimatedIntro.tsx
 * ---------------------------------------------------------------------------
 * Breve animación de apertura (ícono + nombre) que se muestra justo
 * después del splash nativo (que es estático por naturaleza — Android no
 * anima esa pantalla) y antes del onboarding/la app. Le da a la apertura
 * de Verity un momento de marca con movimiento real, sin depender de
 * ninguna librería nueva (usa el Animated de React Native, ya incluido).
 */
import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet, Easing } from 'react-native';

const APP_ICON = require('../../assets/icons/app-icon.png');
const INTRO_DURATION_MS = 1100;

export default function AnimatedIntro({ onFinish }: { onFinish: () => void }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(300),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <Image source={APP_ICON} style={styles.icon} />
        <Animated.Text style={[styles.wordmark, { opacity: textOpacity }]}>VERITY</Animated.Text>
      </Animated.View>
    </View>
  );
}

export { INTRO_DURATION_MS };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 96, height: 96, borderRadius: 22, marginBottom: 16 },
  wordmark: { color: '#F2F2F5', fontSize: 22, fontWeight: '800', letterSpacing: 3 },
});
