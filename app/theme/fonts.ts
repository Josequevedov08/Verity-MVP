/**
 * fonts.ts
 * ---------------------------------------------------------------------------
 * Tipografía de marca: Playfair Display (serif) para títulos, wordmark y
 * el número de sello — le da a Verity el carácter de "documento oficial"
 * que le faltaba (todo el resto de la app sigue usando la fuente del
 * sistema para lectura cómoda en textos largos/valores).
 *
 * IMPORTANTE: se importa el archivo .ttf de UN SOLO peso directamente
 * (no `import { PlayfairDisplay_700Bold } from '@expo-google-fonts/...'`),
 * porque el barrel de ese paquete carga las 12 variantes de una sola vez
 * (~2.2MB) — el mismo problema de bundle inflado que ya se corrigió con
 * los íconos (ver HomeScreen.tsx / SettingsButton.tsx).
 */
import { useFonts } from 'expo-font';

export const FONT_DISPLAY = 'PlayfairDisplay_700Bold';

export function useAppFonts() {
  return useFonts({
    [FONT_DISPLAY]: require('@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf'),
  });
}
