/**
 * PaywallModal.tsx
 * ---------------------------------------------------------------------------
 * Pantalla de "hazte PRO", full-screen igual que el resto de modales de
 * la app. Se muestra cuando el usuario llega al límite gratis mensual
 * (ver CaptureScreen.tsx) o cuando toca voluntariamente el indicador de
 * uso ("3/10 sellos gratis este mes").
 *
 * Ver revenuecatService.ts para el porqué de 'unavailable': hasta que
 * exista un producto de suscripción real en Google Play Console (fase
 * de publicación, deliberadamente pospuesta), tocar "Suscribirme" no
 * puede completar una compra real — se le explica eso al usuario en vez
 * de fallar en silencio o fingir una compra que no es real.
 */
import React, { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { presentPaywall, type SealUsage } from '../services/revenuecatService';
import { FREEMIUM_LIMITS } from '../../documentation/technical/verity-protocol';

const BENEFITS = [
  { icon: 'infinite-outline', text: 'Sellos ilimitados, sin límite mensual' },
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.page, { backgroundColor: colors.surface }]}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>Ahora no</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Ionicons name="ribbon" size={32} color={colors.accentText} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Verity PRO</Text>

          {usage && (
            <Text style={[styles.usageText, { color: colors.textMuted }]}>
              {usage.limitReached
                ? `Ya usaste tus ${usage.limit} sellos gratis de este mes.`
                : `Llevas ${usage.used} de ${usage.limit} sellos gratis este mes.`}
            </Text>
          )}

          <View style={[styles.benefitsCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {BENEFITS.map((b, i) => (
              <View key={b.text} style={[styles.benefitRow, i > 0 && { marginTop: 14 }]}>
                <Ionicons name={b.icon} size={20} color={colors.accent} />
                <Text style={[styles.benefitText, { color: colors.text }]}>{b.text}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.price, { color: colors.text }]}>
            ${FREEMIUM_LIMITS.PRO_MONTHLY_PRICE_USD}
            <Text style={[styles.pricePeriod, { color: colors.textMuted }]}> / mes</Text>
          </Text>

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
            Puedes seguir usando el plan gratis (10 sellos/mes) sin problema.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 16 },
  closeText: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 20 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800' },
  usageText: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  benefitsCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginTop: 28,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { flex: 1, fontSize: 14, fontWeight: '600' },
  price: { fontSize: 32, fontWeight: '800', marginTop: 28 },
  pricePeriod: { fontSize: 15, fontWeight: '600' },
  subscribeButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 54,
  },
  subscribeButtonText: { fontSize: 16, fontWeight: '800' },
  disclaimer: { fontSize: 11.5, marginTop: 14, textAlign: 'center' },
});
