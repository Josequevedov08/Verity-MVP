/**
 * HomeScreen.tsx
 * ---------------------------------------------------------------------------
 * Contenedor de las 3 pestañas principales de Verity: Sellar, Mis sellos,
 * Verificar. Sin login, sin menús adicionales — UX minimalista a propósito.
 *
 * Antes no tenía `tabBarIcon` definido, por lo que React Navigation
 * mostraba su ícono de "falta" (una X) en vez de algo real.
 */
import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// Import directo al submódulo (ver SettingsButton.tsx para el porqué:
// el barrel de @expo/vector-icons carga las 15 familias de íconos de
// una sola vez, ~3MB de fuentes de más).
import Ionicons from '@expo/vector-icons/Ionicons';

import CaptureScreen from './CaptureScreen';
import CertificatesScreen from './CertificatesScreen';
import VerificationScreen from './VerificationScreen';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Sellar: 'camera',
  'Mis sellos': 'images',
  Verificar: 'shield-checkmark',
};

export default function HomeScreen() {
  const { colors, mode } = useTheme();

  // Tema de React Navigation (colores del contenedor/fondo entre pantallas),
  // separado del tema visual de Verity pero alimentado por los mismos colores.
  const navigationTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      text: colors.text,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? TAB_ICONS[route.name] : (`${TAB_ICONS[route.name]}-outline` as keyof typeof Ionicons.glyphMap)}
              size={size}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen name="Sellar" component={CaptureScreen} />
        <Tab.Screen name="Mis sellos" component={CertificatesScreen} />
        <Tab.Screen name="Verificar" component={VerificationScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
