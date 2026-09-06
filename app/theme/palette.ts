/**
 * palette.ts
 * ---------------------------------------------------------------------------
 * Paleta única de colores de Verity, en modo claro y oscuro. Antes cada
 * pantalla tenía sus propios colores sueltos (#fff, #222, #1a73e8...)
 * repetidos y ligeramente distintos entre archivos — esto centraliza todo
 * en un solo lugar para que la app se sienta como un solo producto, y
 * hace posible el modo oscuro real (no solo un color de fondo distinto).
 *
 * El negro del ícono de la app (#0B0B0F aprox.) es la base del modo
 * oscuro, para que el ícono y la app se sientan del mismo sistema visual.
 * El azul de acento (#1A73E8 en claro, más brillante en oscuro para
 * mantener contraste) es el único color de "acción" en toda la app.
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  tabBarInactive: string;
  overlay: string;
}

export const LIGHT: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F4F6F9',
  surfaceAlt: '#EEF2F7',
  border: '#E2E5EA',
  text: '#111114',
  textMuted: '#63666E',
  accent: '#1A73E8',
  accentText: '#FFFFFF',
  success: '#1E8E3E',
  warning: '#B7791F',
  danger: '#C0392B',
  tabBarInactive: '#9AA0A8',
  overlay: 'rgba(0,0,0,0.5)',
};

export const DARK: ThemeColors = {
  background: '#0B0B0F',
  surface: '#17171D',
  surfaceAlt: '#1F1F27',
  border: '#2A2A33',
  text: '#F2F2F5',
  textMuted: '#9A9AA5',
  accent: '#4C9AFF',
  accentText: '#0B0B0F',
  success: '#3DD16F',
  warning: '#E5A93B',
  danger: '#F16A5C',
  tabBarInactive: '#5F5F6B',
  overlay: 'rgba(0,0,0,0.7)',
};

export type ThemeMode = 'light' | 'dark';
