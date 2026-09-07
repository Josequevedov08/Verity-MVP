/**
 * CoachMark.tsx
 * ---------------------------------------------------------------------------
 * Recorrido guiado ("paso a paso, toca aquí") que se muestra una sola
 * vez por pantalla, la primera vez que se entra a ella (ver
 * coachMarkUtils.ts). Resalta un elemento real de la pantalla (medido
 * con `measureInWindow` sobre un ref) con un recorte en el overlay
 * oscuro — no es un ícono decorativo, señala el botón/campo real.
 *
 * El "recorte" (spotlight) se logra con 4 rectángulos oscuros alrededor
 * del área resaltada (arriba/abajo/izquierda/derecha), en vez de una
 * máscara real — más simple, sin depender de SVG, y visualmente
 * idéntico para un recorte rectangular.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const OVERLAY_COLOR = 'rgba(0,0,0,0.72)';
const PADDING = 8; // aire alrededor del elemento resaltado

export interface CoachStep {
  /** Ref al elemento a resaltar (envolver el elemento real en un
   * <View ref={...} collapsable={false}> — collapsable=false es
   * necesario en Android para que el ref se pueda medir). */
  targetRef: React.RefObject<View | null>;
  title: string;
  text: string;
}

export default function CoachMark({
  visible,
  steps,
  onFinish,
}: {
  visible: boolean;
  steps: CoachStep[];
  onFinish: () => void;
}) {
  const { colors } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!visible) {
      setStepIndex(0);
      setRect(null);
      return;
    }
    // Pequeño delay: da tiempo a que la pantalla termine de montar/
    // acomodar su layout antes de medir (medir muy pronto puede dar un
    // rect en (0,0) todavía sin acomodar).
    const timer = setTimeout(() => {
      step?.targetRef.current?.measureInWindow((x, y, width, height) => {
        setRect({ x, y, width, height });
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [visible, stepIndex, step]);

  if (!visible || !step || !rect) return null;

  const highlightTop = rect.y - PADDING;
  const highlightBottom = rect.y + rect.height + PADDING;
  const highlightLeft = rect.x - PADDING;
  const highlightRight = rect.x + rect.width + PADDING;

  // El tooltip se ubica debajo del elemento si hay espacio, si no arriba.
  const tooltipBelow = highlightBottom + 140 < SCREEN_HEIGHT;

  function handleNext() {
    if (isLast) {
      onFinish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 4 franjas oscuras alrededor del recorte — el "agujero" queda
          transparente porque ninguna franja lo cubre. */}
      <View style={[styles.dark, { top: 0, left: 0, right: 0, height: Math.max(0, highlightTop) }]} />
      <View
        style={[
          styles.dark,
          { top: highlightBottom, left: 0, right: 0, bottom: 0 },
        ]}
      />
      <View
        style={[
          styles.dark,
          { top: highlightTop, height: rect.height + PADDING * 2, left: 0, width: Math.max(0, highlightLeft) },
        ]}
      />
      <View
        style={[
          styles.dark,
          { top: highlightTop, height: rect.height + PADDING * 2, left: highlightRight, right: 0 },
        ]}
      />

      {/* Borde de acento alrededor del recorte, para que se note incluso
          sobre fondos claros de la propia UI. */}
      <View
        pointerEvents="none"
        style={[
          styles.highlightBorder,
          {
            top: highlightTop,
            left: highlightLeft,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            borderColor: colors.accent,
          },
        ]}
      />

      {/* Tarjeta con el texto del paso. */}
      <View
        style={[
          styles.tooltip,
          { backgroundColor: colors.background, borderColor: colors.border },
          tooltipBelow ? { top: highlightBottom + 12 } : { top: Math.max(60, highlightTop - 130) },
        ]}
      >
        <Text style={[styles.tooltipTitle, { color: colors.text }]}>{step.title}</Text>
        <Text style={[styles.tooltipText, { color: colors.textMuted }]}>{step.text}</Text>
        <View style={styles.tooltipFooter}>
          <Text style={[styles.tooltipStep, { color: colors.textMuted }]}>
            {stepIndex + 1} / {steps.length}
          </Text>
          <Pressable style={[styles.nextButton, { backgroundColor: colors.accent }]} onPress={handleNext}>
            <Text style={[styles.nextButtonText, { color: colors.accentText }]}>
              {isLast ? 'Entendido' : 'Siguiente'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Saltar el recorrido por completo — siempre visible, arriba. */}
      <Pressable style={styles.skipButton} onPress={onFinish} hitSlop={8}>
        <Text style={styles.skipText}>Saltar ✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { position: 'absolute', backgroundColor: OVERLAY_COLOR },
  highlightBorder: { position: 'absolute', borderWidth: 2, borderRadius: 14 },
  tooltip: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  tooltipTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  tooltipText: { fontSize: 13, lineHeight: 18 },
  tooltipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  tooltipStep: { fontSize: 11.5, fontWeight: '600' },
  nextButton: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 12 },
  nextButtonText: { fontWeight: '700', fontSize: 13 },
  skipButton: { position: 'absolute', top: 50, right: 20 },
  skipText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
});
