/**
 * ThemeContext.tsx
 * ---------------------------------------------------------------------------
 * Provee el tema actual (claro/oscuro) a toda la app, según la preferencia
 * del usuario: "Claro", "Oscuro" o "Sistema" (sigue el modo del teléfono).
 * La preferencia se guarda en AsyncStorage — es la respuesta a "no hay
 * opciones de sistema" que pedías.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT, DARK, type ThemeColors, type ThemeMode } from './palette';

export type ThemePreference = 'light' | 'dark' | 'system';

const PREFERENCE_STORAGE_KEY = 'verity_theme_preference';

interface ThemeContextValue {
  colors: ThemeColors;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(PREFERENCE_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    AsyncStorage.setItem(PREFERENCE_STORAGE_KEY, next);
  }

  const mode: ThemeMode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: mode === 'dark' ? DARK : LIGHT,
      mode,
      preference,
      setPreference,
    }),
    [mode, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() debe usarse dentro de <ThemeProvider>');
  }
  return ctx;
}
