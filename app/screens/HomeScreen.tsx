/**
 * HomeScreen.tsx
 * ---------------------------------------------------------------------------
 * Contenedor de las 3 pestañas principales de Verity: Sellar, Mis sellos,
 * Verificar. Sin login, sin menús adicionales — UX minimalista a propósito.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import CaptureScreen from './CaptureScreen';
import CertificatesScreen from './CertificatesScreen';
import VerificationScreen from './VerificationScreen';

const Tab = createBottomTabNavigator();

export default function HomeScreen() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Sellar" component={CaptureScreen} />
        <Tab.Screen name="Mis sellos" component={CertificatesScreen} />
        <Tab.Screen name="Verificar" component={VerificationScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
