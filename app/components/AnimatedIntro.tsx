/**
 * AnimatedIntro.tsx
 * ---------------------------------------------------------------------------
 * Splash screen inicial de la app, hecho enteramente con el `Animated`
 * nativo de React Native (sin librerías nuevas). Se muestra una sola vez
 * por apertura de la app, justo después del splash nativo estático de
 * Android/iOS (que por naturaleza no puede animarse) y antes del
 * onboarding/la app.
 *
 * El splash NATIVO (app.json → plugin expo-splash-screen,
 * assets/icons/splash-icon.png) ya muestra la caja clara + "VRT" en
 * azul, estática, ANTES de que este componente JS llegue a montarse —
 * así que acá NO se vuelve a animar esa entrada desde cero (antes sí lo
 * hacía: rebote de tamaño 0 + "golpe de sello" del texto). Hacerlo dos
 * veces se veía como un doble splash — el usuario lo notó probando en
 * el teléfono ("primero sale Verity en negro y luego la intro"): el
 * splash nativo mostraba la caja fija, y este componente la reiniciaba
 * a invisible para volver a animarla desde cero, un salto visible.
 * Ahora la caja + "VRT" arrancan YA visibles (idénticos al splash
 * nativo, sin ningún salto) y la animación real empieza directo en el
 * wordmark "VERITY".
 *
 * Secuencia (en este orden exacto):
 *   1. El contenedor + "VRT" ya están visibles desde el primer frame
 *      (continúa exactamente lo que mostraba el splash nativo).
 *   2. Debajo, "VERITY" se revela letra por letra en cascada (ver
 *      CascadeText.tsx) — automático, sin esperar ningún toque.
 *   3. Pausa fija de 2000ms con todo quieto en pantalla.
 *   4. Todo el conjunto (ícono + VRT + VERITY) crece un 15% y luego se
 *      desvanece (fade out).
 *   5. Al terminar, se llama a `onFinish()` — quien lo use decide qué
 *      desmontar/montar (ver App.tsx: pasa a onboarding o a home).
 */
import React, { useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import CascadeText from './CascadeText';

const GROWTH_SCALE = 1.15; // "agrandarse un 15%"
const PAUSE_MS = 2000; // "exactamente 2 segundos de pausa"

export default function AnimatedIntro({ onFinish }: { onFinish: () => void }) {
  // Arranca en 1 (no en 0) — ver nota de arriba: la caja ya está
  // visible desde el splash nativo, no hay entrada que animar. Solo se
  // usa al final, para el crecimiento de salida (1 → 1.15).
  const containerScale = useRef(new Animated.Value(1)).current;
  // Opacidad general: solo se usa al final, para el fundido de salida.
  const overallOpacity = useRef(new Animated.Value(1)).current;

  // "VERITY" arranca de inmediato al montar — ya no espera ninguna
  // animación de entrada del ícono (esa ya "pasó" en el splash nativo).
  const [playCascade] = useState(true);

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
          <Text style={styles.vrtText}>VRT</Text>
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
    // Antes era '#0B0B0F' (igual que el ícono real de la app) — tenía
    // sentido cuando el fondo de ESTA pantalla era claro, pero desde que
    // page.backgroundColor pasó a ser el mismo #0B0B0F (ver arriba), un
    // cuadro negro sobre fondo negro se pierde por completo: sin
    // contraste, solo se distinguía por una sombra que tampoco se nota
    // sobre negro. Blanco acá (distinto del ícono real del launcher,
    // que sí es negro — ahí el contraste lo da el wallpaper del
    // teléfono, no esta pantalla) para que el cuadro se vea de verdad.
    backgroundColor: '#F2F2F5',
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
