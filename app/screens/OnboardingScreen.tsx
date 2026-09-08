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
import { View, Text, StyleSheet, Pressable, ImageBackground } from 'react-native';
// SafeAreaView de 'react-native' está deprecado; se usa el de
// react-native-safe-area-context (requiere <SafeAreaProvider> en App.tsx).
import { SafeAreaView } from 'react-native-safe-area-context';
// Import de subruta (no el paquete completo '@expo/vector-icons') para
// que solo se empaquete la fuente de Ionicons, no las ~20 familias de
// íconos del paquete entero — mismo patrón que ya usa CaptureScreen.tsx.
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

const ACCENT = '#4C9AFF'; // mismo azul de marca que el ícono de la app y el splash.

// Fotos reales (assets/images/onboarding/, provistas por el usuario en
// reference/Img/) — se descartó por completo generar imágenes con IA para
// esto: varios intentos (Canva con queries abstractas, luego prompts
// fotográficos detallados) salieron genéricos o con conceptos que no
// comunicaban el mensaje correcto. Un intento intermedio usó capturas de
// pantalla de la propia app como fondo, pero se veía mal (texto de UI
// sobre texto de UI, ilegible) — se descartó también.
interface Slide {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  image: ReturnType<typeof require>;
}

const SLIDES: Slide[] = [
  {
    title: 'Una foto se puede editar después',
    body: 'Un filtro, una recompresión, hasta reenviarla por WhatsApp — cualquier cambio, y ya no es exactamente la misma foto.',
    icon: 'color-wand-outline',
    image: require('../../assets/images/onboarding/slide-1-edicion.jpg'),
  },
  {
    title: 'Un sello de Verity, no',
    body: 'Por eso tomamos la foto aquí dentro, no desde tu galería: así probamos que existía en este momento exacto, sin ediciones.',
    icon: 'camera-outline',
    image: require('../../assets/images/onboarding/slide-2-camara.jpg'),
  },
  {
    title: 'Toma 2 segundos más',
    body: 'Y esos 2 segundos son la prueba. Así funciona un notario — y así funciona Verity.',
    icon: 'time-outline',
    image: require('../../assets/images/onboarding/slide-3-tiempo.jpg'),
  },
  {
    title: '30 sellos gratis cada mes',
    body: 'Uno al día, todos los días. Si necesitas más, Verity PRO ($4.99/mes) los deja ilimitados — pero nunca es obligatorio para verificar nada.',
    icon: 'ribbon-outline',
    image: require('../../assets/images/onboarding/slide-4-gratis.jpg'),
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    // La foto ocupa la pantalla COMPLETA (no un recorte arriba) — el
    // primer intento (hero al 42% + tarjeta sólida abajo, calcado del
    // patrón de PaywallModal) se veía como una franja chica de foto y el
    // resto negro liso; no era lo pedido. Acá todo el contenido (botón
    // Saltar, ícono, título, texto, puntos, botón) flota ENCIMA de la
    // foto, con un degradado de abajo hacia arriba (sólido en la base,
    // donde está el texto, transparente arriba para que la foto se vea
    // completa) — mismo recurso que el banner PRO, pero vertical en vez
    // de horizontal, como se pidió.
    <ImageBackground source={slide.image} style={styles.page} resizeMode="cover">
      <LinearGradient
        colors={['transparent', 'rgba(10,10,12,0.55)', '#0B0B0F']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <Pressable style={styles.skip} onPress={onDone} hitSlop={8}>
          <Text style={styles.skipText}>Saltar</Text>
        </Pressable>

        <View style={styles.body}>
          <View style={styles.iconBadge}>
            <Ionicons name={slide.icon} size={26} color={ACCENT} />
          </View>

          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.bodyText}>{slide.body}</Text>

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
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0B0B0F' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  skip: { alignSelf: 'flex-end', margin: 24 },
  skipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  body: { paddingHorizontal: 24, paddingBottom: 24 },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(11,11,15,0.7)',
    borderWidth: 1,
    borderColor: `${ACCENT}55`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: '#fff', fontSize: 27, fontWeight: '800', marginBottom: 12 },
  bodyText: { color: '#e4e4e8', fontSize: 16, lineHeight: 24 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 28, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: ACCENT },
  nextButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
