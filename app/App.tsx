/**
 * App.tsx
 * ---------------------------------------------------------------------------
 * Punto de entrada de la app. Inicializa RevenueCat y monta la navegación
 * de 3 pestañas (HomeScreen).
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './screens/HomeScreen';
import { initRevenueCat } from './services/revenuecatService';

export default function App() {
  useEffect(() => {
    initRevenueCat();
  }, []);

  return (
    // Necesario para que <SafeAreaView> de react-native-safe-area-context
    // (usado en las pantallas) calcule los márgenes seguros correctamente.
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <HomeScreen />
    </SafeAreaProvider>
  );
}
