/**
 * OnboardingScreen.tsx
 * ---------------------------------------------------------------------------
 * 3 pantallas que se muestran UNA SOLA VEZ (primera vez que se abre la
 * app), explicando por qué Verity necesita tomar la foto dentro de la
 * app en vez de dejar sellar cualquier archivo. La fricción de "abrir
 * la app para tomar la foto" es intencional (ver README) — esto la
 * convierte en parte de la historia del producto en vez de una sorpresa
 * molesta.
 *
 * Después de esta pantalla, la app abre directo en la cámara (ver
 * CaptureScreen.tsx: dispara la cámara automáticamente en su primer
 * montaje), así que la fricción real termina siendo mínima.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';

interface Slide {
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    title: 'Una foto se puede editar después',
    body: 'Un filtro, una recompresión, hasta reenviarla por WhatsApp — cualquier cambio, y ya no es exactamente la misma foto.',
  },
  {
    title: 'Un sello de Verity, no',
    body: 'Por eso tomamos la foto aquí dentro, no desde tu galería: así probamos que existía en este momento exacto, sin ediciones.',
  },
  {
    title: 'Toma 2 segundos más',
    body: 'Y esos 2 segundos son la prueba. Así funciona un notario — y así funciona Verity.',
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.skip} onPress={onDone}>
        <Text style={styles.skipText}>Saltar</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <Pressable
        style={styles.nextButton}
        onPress={() => (isLast ? onDone() : setIndex(index + 1))}
      >
        <Text style={styles.nextButtonText}>{isLast ? 'Empezar a sellar' : 'Siguiente'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111', padding: 24, justifyContent: 'flex-end' },
  skip: { position: 'absolute', top: 24, right: 24 },
  skipText: { color: '#aaa', fontSize: 14 },
  content: { flex: 1, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 16 },
  body: { color: '#cfd3d8', fontSize: 16, lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#444' },
  dotActive: { backgroundColor: '#1a73e8' },
  nextButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
