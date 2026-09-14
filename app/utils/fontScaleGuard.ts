/**
 * fontScaleGuard.ts
 * ---------------------------------------------------------------------------
 * Bug reportado por testers reales (10-11 sept 2026): si el teléfono tiene
 * el tamaño de letra del sistema (Ajustes de accesibilidad de Android) en
 * grande, "muchas cosas se mueven" — la mayoría de los layouts de Verity
 * usan tamaños fijos en píxeles, no relativos, así que un `fontScale` alto
 * hace que el texto no quepa donde se calculó y empuje/tape botones reales.
 *
 * La solución correcta a largo plazo es rehacer esos layouts con
 * contenedores flexibles, pero eso es un rediseño grande de casi toda la
 * UI. La mitigación inmediata y estándar en React Native es limitar cuánto
 * puede crecer el texto por accesibilidad con `maxFontSizeMultiplier`, en
 * vez de desactivar el escalado del todo (`allowFontScaling={false}`) —
 * así igual se respeta la preferencia de accesibilidad del usuario, solo
 * que acotada a un rango que la UI actual puede absorber sin romperse.
 *
 * Se aplica UNA vez, como default global de `Text` y `TextInput`, para no
 * tener que tocar cada pantalla/componente uno por uno. Debe importarse
 * antes de que se monte cualquier UI (por eso se importa de primero en
 * App.tsx, no dentro de un componente).
 */
import { Text, TextInput } from 'react-native';

// 1.3 = hasta 30% más grande que el tamaño base. Suficiente para que
// alguien con baja visión note la diferencia, sin llegar al punto donde
// los textos largos dejan de caber en tarjetas/botones de ancho fijo
// (donde sí se vio el problema real reportado).
const MAX_FONT_SIZE_MULTIPLIER = 1.3;

export function applyFontScaleGuard(): void {
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  const TextInputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };

  TextAny.defaultProps = TextAny.defaultProps ?? {};
  TextAny.defaultProps.maxFontSizeMultiplier = MAX_FONT_SIZE_MULTIPLIER;

  TextInputAny.defaultProps = TextInputAny.defaultProps ?? {};
  TextInputAny.defaultProps.maxFontSizeMultiplier = MAX_FONT_SIZE_MULTIPLIER;
}
