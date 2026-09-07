/**
 * PaywallModal.tsx
 * ---------------------------------------------------------------------------
 * Pantalla de "hazte PRO". Se muestra cuando el usuario llega al límite
 * gratis mensual (ver CaptureScreen.tsx) o cuando toca voluntariamente
 * el estado del plan (Ajustes → "Plan").
 *
 * El diseño (imagen de fondo + tarjeta que sube desde abajo superpuesta
 * con una insignia grande) sigue una referencia visual que el usuario
 * compartió — adaptada a los componentes reales de la app (React
 * Native puro, sin Tailwind/shadcn: esta app no es web). La imagen del
 * hero (assets/images/paywall-hero.jpg) es del propio usuario, no de un
 * banco de fotos. Encima lleva un degradado con los colores del tema
 * (acento → fondo) para que funcione igual de bien en claro y oscuro —
 * la foto es fija, pero el degradado se adapta.
 *
 * Ver revenuecatService.ts para el porqué de 'unavailable': hasta que
 * exista un producto de suscripción real en Google Play Console (fase
 * de publicación, deliberadamente pospuesta), tocar "Suscribirme" no
 * puede completar una compra real — se le explica eso al usuario en vez
 * de fallar en silencio o fingir una compra que no es real.
 */
import React, { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Alert, ActivityIndicator, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const HERO_IMAGE = require('../../assets/images/paywall-hero.jpg');
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { presentPaywall, restorePurchases, type SealUsage } from '../services/revenuecatService';
import { FREEMIUM_LIMITS } from '../../documentation/technical/verity-protocol';

const BENEFITS = [
  { icon: 'infinite-outline', text: 'Sellos ilimitados, sin límite mensual' },
  { icon: 'layers-outline', text: 'Elige varias fotos o videos de golpe en Galería' },
  { icon: 'flash-outline', text: 'Prioridad al registrar en el registro público' },
  { icon: 'heart-outline', text: 'Apoyas directamente el desarrollo de Verity' },
] as const;

export default function PaywallModal({
  visible,
  usage,
  onClose,
  onPurchased,
}: {
  visible: boolean;
  usage: SealUsage | null;
  onClose: () => void;
  /** Se llama cuando la compra se completó de verdad — quien lo use
   * decide si reintenta la acción que el usuario quería hacer. */
  onPurchased: () => void;
}) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const outcome = await presentPaywall();
      if (outcome.status === 'purchased') {
        onPurchased();
      } else if (outcome.status === 'unavailable') {
        Alert.alert(
          'Todavía no disponible',
          'La suscripción real se activa cuando publiquemos Verity en Play Store — por ahora esto es un adelanto de cómo se verá. Gracias por tu paciencia 🙏',
        );
      }
      // 'cancelled': el usuario cerró el diálogo de compra, no hace falta avisar nada.
    } finally {
      setLoading(false);
    }
  }

  /** Para cuando alguien YA pagó antes pero la app dejó de reconocerlo
   * como PRO (reinstaló, borró datos, etc. — ver revenuecatService.ts).
   * Sin esto no hay forma de recuperar la suscripción sin escribirle a
   * soporte. */
  async function handleRestore() {
    setRestoring(true);
    try {
      const outcome = await restorePurchases();
      if (outcome.restored) {
        onPurchased();
        Alert.alert('Listo', 'Encontramos tu suscripción PRO y la reactivamos.');
      } else {
        Alert.alert(
          'No encontramos una compra',
          outcome.error ?? 'No encontramos ninguna suscripción PRO activa en esta cuenta de Google Play.'
        );
      }
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.page, { backgroundColor: colors.surface }]}>
        {/* Hero: la foto del usuario, con un degradado de los colores del
            TEMA encima (no fijo) — así se adapta a claro/oscuro aunque
            la imagen en sí sea siempre la misma, y se funde limpio con
            la tarjeta de abajo (termina exactamente en colors.surface). */}
        <ImageBackground source={HERO_IMAGE} style={styles.hero} resizeMode="cover">
          <LinearGradient
            colors={[`${colors.accent}40`, colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </SafeAreaView>
        </ImageBackground>

        {/* Insignia superpuesta entre el degradado y la tarjeta (mismo
            truco visual que la referencia: el ícono "flota" partido
            entre las dos secciones). */}
        <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
          <Ionicons name="ribbon" size={34} color={colors.accentText} />
        </View>

        {/* Tarjeta inferior. */}
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Verity <Text style={{ color: colors.accent }}>PRO</Text>
          </Text>

          {usage && (
            <Text style={[styles.usageText, { color: colors.textMuted }]}>
              {usage.limitReached
                ? `Ya usaste tus ${usage.limit} sellos gratis de este mes.`
                : `Llevas ${usage.used} de ${usage.limit} sellos gratis este mes.`}
            </Text>
          )}

          <View style={styles.benefitsList}>
            {BENEFITS.map((b, i) => (
              <View key={b.text} style={[styles.benefitRow, i > 0 && { marginTop: 14 }]}>
                <Ionicons name={b.icon} size={19} color={colors.accent} />
                <Text style={[styles.benefitText, { color: colors.text }]}>{b.text}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.priceOption, { borderColor: colors.accent, backgroundColor: `${colors.accent}14` }]}>
            <Text style={[styles.priceValue, { color: colors.text }]}>
              ${FREEMIUM_LIMITS.PRO_MONTHLY_PRICE_USD}
              <Text style={[styles.pricePeriod, { color: colors.textMuted }]}> / mes</Text>
            </Text>
            <View style={[styles.priceBadge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.priceBadgeText, { color: colors.accentText }]}>ILIMITADO</Text>
            </View>
          </View>

          <Pressable
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Text style={[styles.subscribeButtonText, { color: colors.accentText }]}>Suscribirme</Text>
            )}
          </Pressable>

          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            Se renueva automáticamente cada mes. Cancela cuando quieras desde la Play Store — no hay
            permanencia ni penalidad. Puedes seguir usando el plan gratis (
            {FREEMIUM_LIMITS.FREE_SEALS_PER_MONTH} sellos/mes) sin problema.
          </Text>

          <Pressable onPress={handleRestore} disabled={restoring} hitSlop={8} style={styles.restoreLink}>
            <Text style={[styles.restoreLinkText, { color: colors.accent }]}>
              {restoring ? 'Buscando...' : '¿Ya pagaste antes? Restaurar compra'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const HERO_HEIGHT = 220;
const BADGE_SIZE = 72;

const styles = StyleSheet.create({
  page: { flex: 1 },
  hero: { height: HERO_HEIGHT },
  heroSafeArea: { flex: 1 },
  closeButton: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  badge: {
    position: 'absolute',
    top: HERO_HEIGHT - BADGE_SIZE / 2,
    alignSelf: 'center',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  sheet: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: BADGE_SIZE / 2 + 20,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  usageText: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  benefitsList: { width: '100%', marginTop: 26, gap: 0 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { flex: 1, fontSize: 14, fontWeight: '600' },
  priceOption: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 24,
  },
  priceValue: { fontSize: 20, fontWeight: '800' },
  pricePeriod: { fontSize: 13, fontWeight: '600' },
  priceBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  priceBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  subscribeButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 54,
  },
  subscribeButtonText: { fontSize: 16, fontWeight: '800' },
  disclaimer: { fontSize: 11.5, marginTop: 14, lineHeight: 16, textAlign: 'center' },
  restoreLink: { marginTop: 14, marginBottom: 24 },
  restoreLinkText: { fontSize: 12.5, fontWeight: '700' },
});
