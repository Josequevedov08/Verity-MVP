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
import { View, Text, StyleSheet, Pressable } from 'react-native';
// SafeAreaView de 'react-native' está deprecado; se usa el de
// react-native-safe-area-context (requiere <SafeAreaProvider> en App.tsx).
import { SafeAreaView } from 'react-native-safe-area-context';
// Import de subruta (no el paquete completo '@expo/vector-icons') para
// que solo se empaquete la fuente de Ionicons, no las ~20 familias de
// íconos del paquete entero — mismo patrón que ya usa CaptureScreen.tsx.
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

const ACCENT = '#4C9AFF'; // mismo azul de marca que el ícono de la app y el splash.

interface Slide {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SLIDES: Slide[] = [
  {
    title: 'Una foto se puede editar después',
    body: 'Un filtro, una recompresión, hasta reenviarla por WhatsApp — cualquier cambio, y ya no es exactamente la misma foto.',
    icon: 'color-wand-outline',
  },
  {
    title: 'Un sello de Verity, no',
    body: 'Por eso tomamos la foto aquí dentro, no desde tu galería: así probamos que existía en este momento exacto, sin ediciones.',
    icon: 'camera-outline',
  },
  {
    title: 'Toma 2 segundos más',
    body: 'Y esos 2 segundos son la prueba. Así funciona un notario — y así funciona Verity.',
    icon: 'time-outline',
  },
  {
    title: '30 sellos gratis cada mes',
    body: 'Uno al día, todos los días. Si necesitas más, Verity PRO ($4.99/mes) los deja ilimitados — pero nunca es obligatorio para verificar nada.',
    icon: 'ribbon-outline',
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <SafeAreaView style={styles.container}>
      {/* Fondo con degradado radiando desde el ícono — mismo lenguaje
          visual que el banner PRO/paywall (ImageBackground + LinearGradient
          en SettingsModal.tsx y PaywallModal.tsx), para que el onboarding
          no se sienta plano/genérico frente al resto de la app. Aquí no
          hay una foto de fondo (todavía no hay nada que mostrar del
          usuario en este punto), así que el degradado en sí es el "hero". */}
      <LinearGradient
        colors={[`${ACCENT}33`, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      <Pressable style={styles.skip} onPress={onDone}>
        <Text style={styles.skipText}>Saltar</Text>
      </Pressable>

      <View style={styles.iconBadge}>
        <Ionicons name={slide.icon} size={40} color={ACCENT} />
      </View>

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
  skip: { position: 'absolute', top: 24, right: 24, zIndex: 1 },
  skipText: { color: '#aaa', fontSize: 14 },
  iconBadge: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${ACCENT}1F`,
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 27, fontWeight: '800', marginBottom: 16 },
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
