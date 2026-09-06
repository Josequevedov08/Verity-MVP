/**
 * App.tsx
 * ---------------------------------------------------------------------------
 * Punto de entrada de la app. Inicializa RevenueCat y monta la navegación
 * de 3 pestañas (HomeScreen).
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './screens/HomeScreen';
import { initRevenueCat } from './services/revenuecatService';

export default function App() {
  useEffect(() => {
    initRevenueCat();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <HomeScreen />
    </>
  );
}
