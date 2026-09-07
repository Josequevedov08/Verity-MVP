/**
 * App.tsx
 * ---------------------------------------------------------------------------
 * Punto de entrada de la app. Orquesta, en orden:
 *   1. Intro animada (una sola vez por apertura de la app)
 *   2. Onboarding de 3 pantallas (solo la primera vez que se instala)
 *   3. Navegación normal de 3 pestañas (HomeScreen)
 *
 * Todo envuelto en ThemeProvider (claro/oscuro/sistema) y SafeAreaProvider.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './screens/HomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AnimatedIntro from './components/AnimatedIntro';
import { initRevenueCat } from './services/revenuecatService';
import { hasSeenOnboarding, markOnboardingSeen } from './utils/onboardingUtils';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { useAppFonts } from './theme/fonts';

function AppContent() {
  const { mode, colors } = useTheme();
  // null = todavía no sabemos si mostrar onboarding (evita parpadeo).
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);
  const [introFinished, setIntroFinished] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    initRevenueCat();
    hasSeenOnboarding().then(setSeenOnboarding);
  }, []);

  // Antes, la decisión de a dónde ir después del intro vivía en una
  // función (handleIntroFinish) pasada como prop y capturada UNA sola
  // vez dentro de un useEffect de AnimatedIntro -- si en ese momento
  // `seenOnboarding` todavía era `null`, esa función quedaba "congelada"
  // para siempre con ese valor, y el setTimeout que reintentaba llamaba
  // una y otra vez a la MISMA función obsoleta (nunca a una versión
  // actualizada), dejando la app trabada en pantalla negra. Un efecto
  // que reacciona a los estados actuales evita ese problema por diseño.
  const stage: 'intro' | 'onboarding' | 'home' =
    !introFinished || seenOnboarding === null
      ? 'intro'
      : onboardingDone || seenOnboarding
        ? 'home'
        : 'onboarding';

  async function handleOnboardingDone() {
    await markOnboardingSeen();
    setOnboardingDone(true);
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {stage === 'intro' && <AnimatedIntro onFinish={() => setIntroFinished(true)} />}
      {stage === 'onboarding' && <OnboardingScreen onDone={handleOnboardingDone} />}
      {stage === 'home' && (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <HomeScreen />
        </View>
      )}
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();

  // Mismo fondo que AnimatedIntro mientras carga la tipografía de marca
  // (Playfair Display), para que no haya ningún parpadeo visible — la
  // fuente es un solo archivo de ~190KB, esto tarda milisegundos.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0B0B0F' }} />;
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
