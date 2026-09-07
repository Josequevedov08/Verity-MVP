/**
 * AnimatedIntro.tsx
 * ---------------------------------------------------------------------------
 * Splash screen inicial de la app, hecho enteramente con el `Animated`
 * nativo de React Native (sin librerías nuevas). Se muestra una sola vez
 * por apertura de la app, justo después del splash nativo estático de
 * Android/iOS (que por naturaleza no puede animarse) y antes del
 * onboarding/la app.
 *
 * Secuencia (en este orden exacto):
 *   1. El contenedor negro (redondeado + sombra, como un ícono de app)
 *      aparece con un rebote (spring) desde tamaño 0 — vacío, sin texto.
 *   2. Inmediatamente después, "VRT" aparece encima en blanco con un
 *      efecto rápido tipo "golpe de sello" (opacidad + escala, arranca
 *      grande y se asienta de golpe).
 *   3. Pausa fija de 2000ms con todo quieto en pantalla.
 *   4. El contenedor crece un 15% y luego todo se desvanece (fade out).
 *   5. Al terminar, se llama a `onFinish()` — quien lo use decide qué
 *      desmontar/montar (ver App.tsx: pasa a onboarding o a home).
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

const GROWTH_SCALE = 1.15; // "agrandarse un 15%"
const PAUSE_MS = 2000; // "exactamente 2 segundos de pausa"

export default function AnimatedIntro({ onFinish }: { onFinish: () => void }) {
  // Escala del contenedor: 0 → 1 (rebote de entrada), y más adelante
  // 1 → 1.15 (crecimiento de salida). Un solo valor maneja ambos pasos:
  // como el texto vive DENTRO del contenedor, crece junto con él sin
  // necesitar su propia animación de crecimiento.
  const containerScale = useRef(new Animated.Value(0)).current;
  // Overlay del texto "VRT": arranca grande y transparente, y se asienta
  // de golpe — el mismo lenguaje visual de "sello de tinta" ya usado en
  // StampReveal.tsx para el certificado recién sellado.
  const textScale = useRef(new Animated.Value(2.2)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  // Opacidad general: solo se usa al final, para el fundido de salida.
  const overallOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1) Entrada con rebote del contenedor, vacío.
      Animated.spring(containerScale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      // 2) Efecto sello: "VRT" golpea y se asienta.
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.spring(textScale, {
          toValue: 1,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        }),
      ]),
      // 3) Pausa fija.
      Animated.delay(PAUSE_MS),
      // 4a) Crecimiento del 15%.
      Animated.timing(containerScale, {
        toValue: GROWTH_SCALE,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // 4b) Fundido de salida general.
      Animated.timing(overallOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <View style={styles.page}>
      <Animated.View style={{ opacity: overallOpacity }}>
        <Animated.View style={[styles.container, { transform: [{ scale: containerScale }] }]}>
          <Animated.Text
            style={[styles.vrtText, { opacity: textOpacity, transform: [{ scale: textScale }] }]}
          >
            VRT
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export { PAUSE_MS };

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F2F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 14,
  },
  vrtText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
