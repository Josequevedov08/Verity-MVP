/**
 * CoachMark.tsx
 * ---------------------------------------------------------------------------
 * Recorrido guiado ("paso a paso, toca aquí") que se muestra una sola
 * vez por pantalla, la primera vez que se entra a ella (ver
 * coachMarkUtils.ts). Resalta un elemento real de la pantalla (medido
 * con `measureInWindow` sobre un ref) con un recorte en el overlay
 * oscuro — no es un ícono decorativo, señala el botón/campo real.
 *
 * IMPORTANTE — dónde se monta este componente: `measureInWindow` da
 * coordenadas absolutas de la VENTANA completa (todo el celular, desde
 * arriba del todo). Si este overlay se renderiza ANIDADO dentro del
 * SafeAreaView de la pantalla (que aplica su propio padding por el
 * notch/barra de estado), sus coordenadas locales ya no coinciden con
 * las de `measureInWindow` — el recuadro sale desalineado del botón
 * real. Por eso cada pantalla debe renderizar <CoachMark> como
 * HERMANO del SafeAreaView (fuera de él, ambos dentro de un
 * fragmento <>...</>), nunca como hijo suyo — así comparte el mismo
 * origen (0,0) que toda la ventana. (Se probó envolverlo en un
 * <Modal> para resolver esto mismo, pero en Android
 * `statusBarTranslucent` hace que la pantalla de fondo se reacomode
 * al aparecer el Modal, desalineando la medición de otra forma —
 * ser hermano del SafeAreaView evita el problema de raíz sin tocar
 * la barra de estado.)
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
    setRect(null);
    // .measure() en vez de .measureInWindow(): da pageX/pageY por una
    // ruta nativa distinta (measureLayout relativo a la raíz de la
    // página) que en la práctica resulta más confiable en Android que
    // measureInWindow para este caso.
    //
    // Bug real reportado por una tester (10-11 sept 2026): en su
    // teléfono el recorte quedaba desalineado del botón real, tapándolo
    // y bloqueando el scroll (los paneles oscuros capturan el toque
    // fuera del recorte). Antes se medía 3 veces a tiempos fijos
    // (120/350/700ms) y se usaba la última sin verificar nada — en un
    // teléfono más lento, o con una pantalla anterior todavía
    // reacomodándose (ej. texto más grande por accesibilidad tardando
    // más en re-envolver), esa última medición podía seguir siendo
    // vieja, y el recorte se quedaba pegado en la posición incorrecta.
    //
    // Ahora se mide en un bucle hasta que dos mediciones seguidas den
    // exactamente el mismo resultado (el layout ya se asentó), con un
    // tope de intentos por si el elemento nunca llega a medir bien —
    // así nunca depende de adivinar cuántos milisegundos hacen falta.
    let cancelled = false;
    let lastRect: { x: number; y: number; width: number; height: number } | null = null;
    let stableCount = 0;
    let attempts = 0;
    const MAX_ATTEMPTS = 25; // ~2.5s a 100ms por intento, tope de seguridad
    const STABLE_READINGS_NEEDED = 2;

    function scheduleNext() {
      if (cancelled) return;
      setTimeout(tick, attempts === 0 ? 80 : 100);
    }

    function tick() {
      if (cancelled) return;
      attempts += 1;
      step?.targetRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
        if (cancelled) return;
        if (width > 0 && height > 0) {
          const next = { x: pageX, y: pageY, width, height };
          const same =
            !!lastRect &&
            lastRect.x === next.x &&
            lastRect.y === next.y &&
            lastRect.width === next.width &&
            lastRect.height === next.height;
          stableCount = same ? stableCount + 1 : 0;
          lastRect = next;
          setRect(next);
        }
        if (stableCount < STABLE_READINGS_NEEDED && attempts < MAX_ATTEMPTS) {
          scheduleNext();
        }
      });
    }

    scheduleNext();
    return () => {
      cancelled = true;
    };
  }, [visible, stepIndex, step]);

  if (!visible || !step || !rect) return null;

  function handleNext() {
    if (isLast) {
      onFinish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  return (
    <CoachMarkOverlay
      step={step}
      rect={rect}
      stepIndex={stepIndex}
      totalSteps={steps.length}
      isLast={isLast}
      onNext={handleNext}
      onSkip={onFinish}
      accentColor={colors.accent}
      accentTextColor={colors.accentText}
      bgColor={colors.background}
      borderColor={colors.border}
      textColor={colors.text}
      mutedColor={colors.textMuted}
    />
  );
}

/** Fuera del componente padre a propósito: si viviera anidada, React la
 * redefiniría en cada render (una función nueva cada vez), perdiendo su
 * identidad de componente y remontándose sin necesidad. */
function CoachMarkOverlay({
  step,
  rect,
  stepIndex,
  totalSteps,
  isLast,
  onNext,
  onSkip,
  accentColor,
  accentTextColor,
  bgColor,
  borderColor,
  textColor,
  mutedColor,
}: {
  step: CoachStep;
  rect: { x: number; y: number; width: number; height: number };
  stepIndex: number;
  totalSteps: number;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
  accentColor: string;
  accentTextColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
}) {
  const highlightTop = rect.y - PADDING;
  const highlightBottom = rect.y + rect.height + PADDING;
  const highlightLeft = rect.x - PADDING;
  const highlightRight = rect.x + rect.width + PADDING;

  // El tooltip se ubica debajo del elemento si hay espacio, si no arriba.
  const tooltipBelow = highlightBottom + 140 < SCREEN_HEIGHT;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 4 franjas oscuras alrededor del recorte — el "agujero" queda
          transparente porque ninguna franja lo cubre. */}
      <View style={[styles.dark, { top: 0, left: 0, right: 0, height: Math.max(0, highlightTop) }]} />
      <View style={[styles.dark, { top: highlightBottom, left: 0, right: 0, bottom: 0 }]} />
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
            borderColor: accentColor,
          },
        ]}
      />

      {/* Tarjeta con el texto del paso. */}
      <View
        style={[
          styles.tooltip,
          { backgroundColor: bgColor, borderColor },
          tooltipBelow ? { top: highlightBottom + 12 } : { top: Math.max(60, highlightTop - 130) },
        ]}
      >
        <Text style={[styles.tooltipTitle, { color: textColor }]}>{step.title}</Text>
        <Text style={[styles.tooltipText, { color: mutedColor }]}>{step.text}</Text>
        <View style={styles.tooltipFooter}>
          <Text style={[styles.tooltipStep, { color: mutedColor }]}>
            {stepIndex + 1} / {totalSteps}
          </Text>
          <Pressable style={[styles.nextButton, { backgroundColor: accentColor }]} onPress={onNext}>
            <Text style={[styles.nextButtonText, { color: accentTextColor }]}>
              {isLast ? 'Entendido' : 'Siguiente'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Saltar el recorrido por completo — siempre visible, arriba. */}
      <Pressable style={styles.skipButton} onPress={onSkip} hitSlop={8}>
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
