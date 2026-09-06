/**
 * App.tsx
 * ---------------------------------------------------------------------------
 * Punto de entrada de la app. Inicializa RevenueCat, muestra el
 * onboarding de 3 pantallas la primera vez que se abre la app, y monta
 * la navegación de 3 pestañas (HomeScreen) — que a su vez abre directo
 * en la cámara (ver CaptureScreen.tsx).
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './screens/HomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { initRevenueCat } from './services/revenuecatService';
import { hasSeenOnboarding, markOnboardingSeen } from './utils/onboardingUtils';

export default function App() {
  // null = todavía no sabemos (evita un parpadeo mostrando la pantalla
  // equivocada mientras se lee AsyncStorage).
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    initRevenueCat();
    hasSeenOnboarding().then((seen) => setShowOnboarding(!seen));
  }, []);

  async function handleOnboardingDone() {
    await markOnboardingSeen();
    setShowOnboarding(false);
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {showOnboarding === null ? (
        <View style={{ flex: 1, backgroundColor: '#111111' }} />
      ) : showOnboarding ? (
        <OnboardingScreen onDone={handleOnboardingDone} />
      ) : (
        <HomeScreen />
      )}
    </SafeAreaProvider>
  );
}
