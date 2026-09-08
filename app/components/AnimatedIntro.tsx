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
 *   3. Debajo del ícono, "VERITY" se revela letra por letra en cascada
 *      (ver CascadeText.tsx) — automático, sin esperar ningún toque.
 *   4. Pausa fija de 2000ms con todo quieto en pantalla.
 *   5. Todo el conjunto (ícono + VRT + VERITY) crece un 15% y luego se
 *      desvanece (fade out).
 *   6. Al terminar, se llama a `onFinish()` — quien lo use decide qué
 *      desmontar/montar (ver App.tsx: pasa a onboarding o a home).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import CascadeText from './CascadeText';

const GROWTH_SCALE = 1.15; // "agrandarse un 15%"
const PAUSE_MS = 2000; // "exactamente 2 segundos de pausa"

export default function AnimatedIntro({ onFinish }: { onFinish: () => void }) {
  // Escala de TODO el conjunto (ícono + VRT + VERITY): 0 → 1 (rebote de
  // entrada) y, al final, 1 → 1.15 (crecimiento de salida). Vive en el
  // envoltorio exterior, no en el ícono solo, para que el wordmark
  // "VERITY" crezca junto con él en el paso final.
  const containerScale = useRef(new Animated.Value(0)).current;
  // Overlay del texto "VRT": arranca grande y transparente, y se asienta
  // de golpe — el mismo lenguaje visual de "sello de tinta" ya usado en
  // StampReveal.tsx para el certificado recién sellado.
  const textScale = useRef(new Animated.Value(2.2)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  // Opacidad general: solo se usa al final, para el fundido de salida.
  const overallOpacity = useRef(new Animated.Value(1)).current;

  // "VERITY" no arranca solo — espera a que el ícono termine de rebotar
  // Y el golpe de sello de "VRT" se asiente, para que se sienta como
  // una secuencia (ícono → sello → wordmark), no todo junto de golpe.
  const [playCascade, setPlayCascade] = useState(false);

  useEffect(() => {
    Animated.sequence([
      // 1) Entrada con rebote de TODO el conjunto, vacío.
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
    ]).start(() => setPlayCascade(true));
  }, []);

  /** Se llama cuando la última letra de "VERITY" termina de revelarse —
   * recién ahí empieza la pausa fija, no antes (si no, la pausa se
   * comería parte de la propia animación de las letras). */
  function handleCascadeComplete() {
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(containerScale, {
          toValue: GROWTH_SCALE,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overallOpacity, {
          toValue: 0,
          duration: 380,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => onFinish());
    }, PAUSE_MS);
  }

  return (
    <View style={styles.page}>
      <Animated.View
        style={{
          opacity: overallOpacity,
          alignItems: 'center',
          transform: [{ scale: containerScale }],
        }}
      >
        <View style={styles.container}>
          <Animated.Text
            style={[styles.vrtText, { opacity: textOpacity, transform: [{ scale: textScale }] }]}
          >
            VRT
          </Animated.Text>
        </View>

        <View style={styles.wordmarkWrap}>
          {/* CascadeText usa '#1A1A1F' (casi negro) por defecto — tenía
              sentido cuando el fondo del splash era claro (se decidió así
              explícitamente), pero se volvió invisible al pasar el fondo
              de esta pantalla a '#0B0B0F' (casi negro también) para
              arreglar el salto claro→oscuro. Bug real, no cosmético: el
              wordmark completo desaparecía. Color claro explícito para
              que quede visible sobre el fondo oscuro actual. */}
          <CascadeText
            text="VERITY"
            color="#F2F2F5"
            play={playCascade}
            onComplete={handleCascadeComplete}
          />
        </View>
      </Animated.View>
    </View>
  );
}

export { PAUSE_MS };

const styles = StyleSheet.create({
  page: {
    flex: 1,
    // Antes era '#F2F2F5' (gris claro) — un resto de cuando el ícono era
    // negro puro sobre fondo claro. Cuando el ícono pasó a este mismo
    // #0B0B0F oscuro (ver styles.container abajo), este fondo se quedó
    // desactualizado: se veía un cuadro oscuro flotando sobre una pantalla
    // clara, y justo después arranca el onboarding en modo oscuro — un
    // salto de claro a oscuro notorio que el usuario señaló probando en el
    // teléfono. Ahora todo el splash es de un solo tono, consistente con
    // el resto de la app.
    backgroundColor: '#0B0B0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: 120,
    height: 120,
    borderRadius: 28,
    // Mismos colores que el ícono real de la app (assets/icons/app-icon.png)
    // — antes este cuadro era negro puro con "VRT" en blanco, el mismo
    // placeholder que tenía el ícono antes de llevarlo al azul de marca;
    // se quedó desactualizado cuando cambiamos el ícono y nadie lo notó
    // hasta que el usuario lo señaló probando en el teléfono.
    backgroundColor: '#0B0B0F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 14,
  },
  vrtText: {
    color: '#4C9AFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
  },
  wordmarkWrap: { marginTop: 18 },
});
