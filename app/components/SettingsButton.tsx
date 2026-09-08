/**
 * SettingsButton.tsx
 * ---------------------------------------------------------------------------
 * Ícono de engranaje que abre el panel de ajustes (SettingsModal). Por
 * defecto flota en la esquina superior derecha (uso en Sellar/Verificar);
 * con `inline` se comporta como un botón normal dentro de una fila, para
 * cuando comparte espacio con otro ícono (ej. Mis sellos, junto al
 * selector de lista/grilla).
 *
 * También es, a propósito, el único lugar donde vive el indicador de PRO
 * fuera de Ajustes: como este botón ya está presente en las 3 pestañas,
 * una insignia pequeña acá se ve en todos lados sin tener que agregar
 * nada nuevo a cada pantalla — pensada para distinguir sin competir con
 * el contenido (el usuario pidió explícitamente "que no robe la
 * atención pero sí destaque frente al plan gratis").
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
// Import directo al submódulo (no desde el paquete raíz): el barrel de
// @expo/vector-icons carga las 15 familias de íconos de una sola vez
// (~3MB de fuentes), incluso "solo" para usar Ionicons. Esto hacía que
// la app tardara mucho en transferirse al teléfono por Metro,
// especialmente con señal móvil débil.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { getSealUsage } from '../services/revenuecatService';
import SettingsModal from './SettingsModal';

export default function SettingsButton({ inline }: { inline?: boolean }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [isPro, setIsPro] = useState(false);

  // Se refresca cada vez que la pestaña vuelve a tener foco (cubre
  // comprar/restaurar PRO desde el paywall de Sellar) y otra vez al
  // cerrar Ajustes (cubre restaurar/activar el modo prueba desde ahí
  // mismo, sin esperar a cambiar de pestaña).
  useFocusEffect(
    useCallback(() => {
      getSealUsage().then((u) => setIsPro(u.isPro));
    }, [])
  );

  function handleClose() {
    setVisible(false);
    getSealUsage().then((u) => setIsPro(u.isPro));
  }

  return (
    <>
      {/* Envoltorio del tamaño EXACTO del botón (40x40), a propósito
          separado del Pressable: la insignia se posiciona "absolute"
          relativa a ESTE View, nunca directo dentro del Pressable —
          en pruebas reales (ver captura del usuario) posicionarla como
          hijo del Pressable la dejaba flotando lejos de la esquina en
          vez de pegada, probablemente porque Pressable no garantiza
          ser el "contenedor de posicionamiento" que un View normal sí
          es. Con un View explícito de tamaño fijo como ancla, el
          top/right de la insignia son relativos a algo predecible. */}
      <View style={[styles.wrap, !inline && styles.floating]}>
        <Pressable
          style={[styles.button, { backgroundColor: colors.surfaceAlt }]}
          onPress={() => setVisible(true)}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
        </Pressable>
        {isPro && (
          <View style={[styles.proBadge, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
            <Text
              style={[styles.proBadgeText, { color: colors.accentText }]}
              allowFontScaling={false}
            >
              PRO
            </Text>
          </View>
        )}
      </View>
      <SettingsModal visible={visible} onClose={handleClose} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 40, height: 40 },
  floating: { position: 'absolute', top: 0, right: 0 },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 26,
    height: 15,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.4, lineHeight: 9 },
});
