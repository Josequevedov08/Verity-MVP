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

type AppStage = 'intro' | 'onboarding' | 'home';

function AppContent() {
  const { mode, colors } = useTheme();
  // null = todavía no sabemos si mostrar onboarding (evita parpadeo).
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);
  const [stage, setStage] = useState<AppStage>('intro');

  useEffect(() => {
    initRevenueCat();
    hasSeenOnboarding().then(setSeenOnboarding);
  }, []);

  function handleIntroFinish() {
    // Si ya sabemos que el onboarding fue visto, saltamos directo a home;
    // si todavía no llega la respuesta de AsyncStorage, esperamos un
    // instante más en la propia intro (poco frecuente, solo primer frame).
    if (seenOnboarding === null) {
      setTimeout(handleIntroFinish, 50);
      return;
    }
    setStage(seenOnboarding ? 'home' : 'onboarding');
  }

  async function handleOnboardingDone() {
    await markOnboardingSeen();
    setStage('home');
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {stage === 'intro' && <AnimatedIntro onFinish={handleIntroFinish} />}
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
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
