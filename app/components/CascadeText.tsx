/**
 * CascadeText.tsx
 * ---------------------------------------------------------------------------
 * Texto que aparece letra por letra, en cascada (cada carácter entra un
 * poco después que el anterior) — mismo espíritu visual que el
 * componente de referencia que compartió el usuario ("HOVER ME"), pero
 * NO es ese componente: ese era React web (Tailwind, DOM, disparado al
 * pasar el mouse) — no aplica directo a una app de React Native. Esta
 * es una reconstrucción del efecto con `Animated` de RN, disparada
 * automáticamente (no hay mouse en un celular) vía la prop `play`.
 *
 * Se usa en AnimatedIntro.tsx para el wordmark "VERITY" del splash.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

export default function CascadeText({
  text,
  play,
  onComplete,
  fontSize = 30,
  color = '#1A1A1F',
  letterSpacing = 3,
  staggerDelay = 45,
  duration = 320,
}: {
  text: string;
  /** Cuando pasa de false a true, dispara la cascada (una sola vez). */
  play: boolean;
  onComplete?: () => void;
  fontSize?: number;
  color?: string;
  letterSpacing?: number;
  staggerDelay?: number;
  duration?: number;
}) {
  const chars = text.split('');
  // Un Animated.Value por letra — se crea una sola vez (no en cada
  // render) para que la animación no se reinicie sola.
  const anims = useRef(chars.map(() => new Animated.Value(0))).current;
  const hasPlayed = useRef(false);

  useEffect(() => {
    if (!play || hasPlayed.current) return;
    hasPlayed.current = true;

    const animations = anims.map((value) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    Animated.stagger(staggerDelay, animations).start(() => onComplete?.());
  }, [play]);

  return (
    <View style={styles.row}>
      {chars.map((char, i) => {
        // Cada letra entra deslizándose desde abajo (traslado) mientras
        // aparece (opacidad) — el equivalente en RN al truco de
        // text-shadow + translateY de la referencia web, que no tiene
        // forma directa de traducirse a React Native.
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [fontSize * 0.6, 0] });
        return (
          <View key={i} style={[styles.charMask, { height: fontSize * 1.3 }]}>
            <Animated.Text
              style={[
                styles.char,
                {
                  fontSize,
                  color,
                  letterSpacing,
                  opacity: anims[i],
                  transform: [{ translateY }],
                },
              ]}
            >
              {char === ' ' ? ' ' : char}
            </Animated.Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  // overflow:'hidden' recorta la letra mientras todavía está deslizando
  // desde abajo del recuadro de su propia línea — sin esto, se vería
  // "flotando" fuera de lugar durante la animación en vez de
  // revelarse limpiamente.
  charMask: { overflow: 'hidden', justifyContent: 'flex-end' },
  char: { fontWeight: '800' },
});
