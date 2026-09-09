/**
 * SettingsModal.tsx
 * ---------------------------------------------------------------------------
 * Panel de ajustes: selector de apariencia (Claro/Oscuro/Sistema) +
 * sección "Acerca de Verity" con versión, red y la wallet del
 * dispositivo (copiable) + "Legal y ayuda".
 *
 * Antes era una hoja inferior (bottom sheet) que solo tapaba parte de
 * la pantalla — se sentía como si "se abriera desde abajo" mostrando
 * parte de la pantalla anterior detrás, y al vivir dentro de un
 * ScrollView anidado en un Pressable de fondo, el gesto de deslizar
 * para hacer scroll a veces no se registraba bien (competía con el
 * Pressable del backdrop). Ahora es una pantalla completa propia,
 * igual que CertificateDetailModal/LegalContentModal — más predecible
 * para hacer scroll y visualmente consistente con el resto de la app.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Image, ImageBackground, ScrollView, Alert, Switch, ActivityIndicator, DevSettings } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// Import directo al submódulo (ver SettingsButton.tsx para el porqué:
// el barrel de @expo/vector-icons carga las 15 familias de íconos de
// una sola vez, ~3MB de fuentes de más).
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useTheme, type ThemePreference } from '../theme/ThemeContext';
import {
  getDeviceWalletAddress,
  exportDeviceWalletPrivateKey,
  restoreDeviceWalletFromPrivateKey,
} from '../services/blockchainService';
import { resetAllCoachMarks } from '../utils/coachMarkUtils';
import { resetOnboardingSeen } from '../utils/onboardingUtils';
import { getCertificates } from '../utils/cryptoUtils';
import { syncAllToPublicIndex } from '../services/verificationIndexService';
import {
  getSealUsage,
  restorePurchases,
  getDevProOverride,
  setDevProOverride,
  isDevProOverrideAllowed,
  type SealUsage,
} from '../services/revenuecatService';
import LegalContentModal, { LEGAL_DOCS, type LegalDocId } from './LegalContentModal';
import PaywallModal from './PaywallModal';
import { FREEMIUM_LIMITS } from '../../documentation/technical/verity-protocol';

const APP_ICON = require('../../assets/icons/app-icon.png');
// Foto propia del usuario (no de un banco de imágenes) — mismo archivo
// que el hero del paywall, ver PaywallModal.tsx para el detalle.
const HERO_IMAGE = require('../../assets/images/paywall-hero.jpg');
// Mantener en sync con la versión de package.json / app.json.
const APP_VERSION = '0.3.41';

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Oscuro', icon: 'moon-outline' },
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
];

export default function SettingsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, preference, setPreference } = useTheme();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [openDoc, setOpenDoc] = useState<LegalDocId | null>(null);
  // Estado del plan (gratis/PRO) — Ajustes es la única pantalla que lo
  // muestra de forma permanente (ver StatsCard.tsx y CaptureScreen.tsx
  // para el porqué de que ya NO se repita ahí).
  const [usage, setUsage] = useState<SealUsage | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Modo prueba (Expo Go o build "preview") — ver isDevProOverrideAllowed
  // en revenuecatService.ts. Nunca existe en un build de producción real.
  const [devProOverride, setDevProOverrideState] = useState(false);
  const [syncingIndex, setSyncingIndex] = useState(false);

  async function handleToggleDevPro(next: boolean) {
    setDevProOverrideState(next);
    await setDevProOverride(next);
    getSealUsage().then(setUsage);
  }

  /** Ver PaywallModal.tsx / revenuecatService.ts para el porqué de
   * esto: sin cuenta/login, si alguien borra los datos de la app o
   * reinstala, la app deja de reconocerlo como PRO aunque ya haya
   * pagado — restaurar le pregunta directo a Google Play. */
  async function handleRestore() {
    setRestoring(true);
    try {
      const outcome = await restorePurchases();
      if (outcome.restored) {
        getSealUsage().then(setUsage);
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

  /**
   * Antes esto solo reiniciaba una bandera en AsyncStorage sin ningún
   * efecto visible inmediato — la pestaña donde estabas (ej. Sellar)
   * ya estaba montada de antes y no volvía a revisar su propio estado
   * solo porque el dato cambió. resetAllCoachMarks ahora también avisa
   * en memoria a las pantallas ya montadas (ver
   * useCoachMarkResetVersion), y aquí cerramos Ajustes de inmediato:
   * al volver a la pantalla de siempre, su recorrido ya aparece solo,
   * sin tener que salir y re-entrar a la pestaña.
   */
  async function handleReplayTour() {
    await resetAllCoachMarks();
    onClose();
  }

  /**
   * A diferencia del recorrido guiado (arriba), el splash + onboarding
   * viven en un estado de App.tsx que este modal no puede tocar
   * directo (no hay contexto compartido para eso) — así que reiniciar
   * SOLO la marca de "ya visto" en AsyncStorage no alcanza mientras la
   * app siga corriendo con el mismo estado en memoria. DevSettings.reload()
   * fuerza una recarga completa del JS (como presionar "r" en la
   * terminal), que sí vuelve a montar App.tsx desde cero y respeta la
   * marca ya borrada.
   */
  async function handleReplayOnboarding() {
    await resetOnboardingSeen();
    DevSettings.reload();
  }

  useEffect(() => {
    if (visible && !walletAddress) {
      getDeviceWalletAddress().then(setWalletAddress).catch(() => {});
    }
    // El uso del mes sí se refresca cada vez que se abre (a diferencia
    // de la wallet, que no cambia): puede haber sellado algo desde la
    // última vez que se vio Ajustes.
    if (visible) {
      getSealUsage().then(setUsage);
      getDevProOverride().then(setDevProOverrideState);
    }
  }, [visible]);

  async function handleCopyWallet() {
    if (!walletAddress) return;
    await Clipboard.setStringAsync(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  /**
   * Sin esto, si el usuario borra los datos de la app o cambia de
   * teléfono, pierde para siempre la identidad con la que selló antes
   * (ya le pasó una vez en pruebas reales — ver blockchainService.ts).
   * El archivo generado contiene la clave privada en texto plano: tan
   * sensible como una contraseña, de ahí la advertencia explícita antes
   * de generarlo.
   */
  async function handleBackupWallet() {
    Alert.alert(
      'Respaldar tu wallet',
      'Se va a generar un archivo con la clave de tu wallet. Guárdalo en un lugar seguro y NUNCA lo compartas: quien lo tenga puede sellar como si fuera este teléfono. Es la única forma de recuperar tu identidad si pierdes el teléfono o borras los datos de la app.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: async () => {
            try {
              const privateKey = await exportDeviceWalletPrivateKey();
              const address = walletAddress ?? (await getDeviceWalletAddress());
              const backup = {
                version: 1,
                walletAddress: address,
                privateKey,
                exportedAt: new Date().toISOString(),
              };

              const file = new File(Paths.cache, `verity-wallet-backup-${Date.now()}.json`);
              if (!file.exists) file.create({ intermediates: true });
              file.write(JSON.stringify(backup, null, 2));

              const canShare = await Sharing.isAvailableAsync();
              if (!canShare) {
                Alert.alert('No disponible', 'Compartir archivos no está disponible en este dispositivo.');
                return;
              }
              await Sharing.shareAsync(file.uri, {
                mimeType: 'application/json',
                dialogTitle: 'Guardar respaldo de tu wallet',
              });
            } catch (error) {
              console.error('Error al respaldar la wallet:', error);
              Alert.alert('Error', 'No se pudo generar el respaldo.');
            }
          },
        },
      ]
    );
  }

  /** Reemplaza la wallet de este teléfono por la de un respaldo — para
   * cuando alguien cambió de teléfono y quiere recuperar la identidad
   * con la que ya había sellado antes. */
  async function handleRestoreWallet() {
    Alert.alert(
      'Restaurar wallet desde respaldo',
      'Esto reemplaza la wallet de este teléfono por la del archivo que elijas. Solo hazlo si sabes lo que contiene el archivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Elegir archivo',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });
              if (result.canceled || !result.assets[0]) return;

              // fetch() en vez de la clase File nueva: más robusto con
              // las rutas que entrega el selector de documentos (mismo
              // motivo que en CertificatesScreen.handleImport).
              const text = await fetch(result.assets[0].uri).then((res) => res.text());
              const backup = JSON.parse(text) as { privateKey?: string };

              if (!backup?.privateKey) {
                Alert.alert('Archivo inválido', 'Este archivo no parece ser un respaldo de wallet de Verity.');
                return;
              }

              const address = await restoreDeviceWalletFromPrivateKey(backup.privateKey);
              setWalletAddress(address);
              Alert.alert('Wallet restaurada', `Este teléfono ahora usa la wallet ${truncateAddress(address)}.`);
            } catch (error) {
              console.error('Error al restaurar la wallet:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo restaurar la wallet.');
            }
          },
        },
      ]
    );
  }

  /**
   * Registra en el índice público TODO el historial local de este
   * dispositivo, de una sola vez. Existe porque el envío automático al
   * sellar (ver CaptureScreen.tsx) solo se agregó en la versión 0.3.3 —
   * cualquier cosa sellada ANTES quedó huérfana del índice para siempre
   * sin esto: el archivo no cambió, pero "por archivo" en la página
   * pública de verificación nunca lo iba a encontrar (solo "por número de
   * sello" funcionaba, porque ese consulta la blockchain directo).
   */
  async function handleSyncPublicIndex() {
    setSyncingIndex(true);
    try {
      const certificates = await getCertificates();
      const summary = await syncAllToPublicIndex(certificates);
      Alert.alert(
        'Listo',
        summary.total === 0
          ? 'Todavía no tienes ningún sello que sincronizar.'
          : `${summary.synced} de ${summary.total} certificados quedaron en el índice público.`
      );
    } catch (error) {
      console.error('Error al sincronizar el índice público:', error);
      Alert.alert('Error', 'No se pudo completar la sincronización. Intenta de nuevo.');
    } finally {
      setSyncingIndex(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.page, { backgroundColor: colors.surface }]}>
        <View style={styles.topBar}>
          <Text style={[styles.title, { color: colors.text }]}>Ajustes</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.closeText, { color: colors.accent }]}>Cerrar ✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Banner de PRO — lo PRIMERO que se ve al abrir Ajustes, a
                propósito. Antes el estado del plan vivía como una fila
                más entre "Red" y "Wallet del dispositivo", dentro de
                "Acerca de Verity" — demasiado discreto: "no aparece en
                ningún lado" fue el comentario real de una prueba. Un
                banner arriba de todo, siempre visible, no se puede
                pasar por alto. */}
            {usage && !usage.isPro && (
              <Pressable onPress={() => setPaywallVisible(true)}>
                <ImageBackground
                  source={HERO_IMAGE}
                  style={styles.proBanner}
                  imageStyle={{ borderRadius: 20 }}
                >
                  <LinearGradient
                    colors={[colors.accent, `${colors.accent}00`]}
                    locations={[0.42, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                  />
                  <View style={styles.proBannerBadge}>
                    <Ionicons name="shield-checkmark" size={26} color="#fff" />
                  </View>
                  <View style={styles.proBannerText}>
                    <Text style={styles.proBannerTitle}>Verity PRO</Text>
                    <Text style={styles.proBannerSubtitle}>
                      Sellos ilimitados · varios de golpe · prioridad al registrar
                    </Text>
                    <View style={styles.proBannerUsageRow}>
                      <View style={styles.proBannerUsagePill}>
                        <Text style={styles.proBannerUsageText}>
                          {usage.used}/{usage.limit} gratis este mes
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.proBannerCta}>
                    <Text style={styles.proBannerPrice}>${FREEMIUM_LIMITS.PRO_MONTHLY_PRICE_USD}</Text>
                    <Text style={styles.proBannerPricePeriod}>/mes</Text>
                    <Ionicons name="chevron-forward" size={16} color="#fff" style={{ marginTop: 4 }} />
                  </View>
                </ImageBackground>
              </Pressable>
            )}
            {usage && usage.isPro && (
              <ImageBackground source={HERO_IMAGE} style={styles.proBanner} imageStyle={{ borderRadius: 20 }}>
                <LinearGradient
                  colors={[colors.accent, `${colors.accent}00`]}
                  locations={[0.42, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                />
                <View style={styles.proBannerBadge}>
                  <Ionicons name="shield-checkmark" size={26} color="#fff" />
                </View>
                <View style={styles.proBannerText}>
                  <Text style={styles.proBannerTitle}>Verity PRO activo</Text>
                  <Text style={styles.proBannerSubtitle}>Sellos ilimitados · gracias por tu apoyo</Text>
                </View>
              </ImageBackground>
            )}
            {usage && !usage.isPro && (
              <Pressable onPress={handleRestore} disabled={restoring} hitSlop={8} style={styles.restoreLink}>
                <Text style={[styles.restoreLinkText, { color: colors.accent }]}>
                  {restoring ? 'Buscando...' : '¿Ya pagaste antes? Restaurar compra'}
                </Text>
              </Pressable>
            )}

            {/* Visible en Expo Go (__DEV__) y en el build "preview" de
                EAS (ver isDevProOverrideAllowed en revenuecatService.ts
                — controlado por una variable de entorno que SOLO se
                configura en el entorno "preview", nunca en
                "production"). En el build real que algún día se suba a
                la tienda, isDevProOverrideAllowed siempre da false, así
                que no hay forma de activar PRO gratis en la app
                publicada. Sirve para probar/grabar lo que ve un usuario
                PRO (lote múltiple, etc.) mientras no existe un producto
                de suscripción real dado de alta en Play Console. */}
            {isDevProOverrideAllowed && (
              <View style={[styles.devBox, { borderColor: colors.warning, backgroundColor: colors.background }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.devBoxTitle, { color: colors.warning }]}>Modo prueba (solo desarrollo)</Text>
                  <Text style={[styles.devBoxText, { color: colors.textMuted }]}>
                    Simula tener PRO en este teléfono, sin pagar de verdad. No existe en la app publicada.
                  </Text>
                </View>
                <Switch
                  value={devProOverride}
                  onValueChange={handleToggleDevPro}
                  trackColor={{ false: colors.border, true: colors.warning }}
                  thumbColor="#fff"
                />
              </View>
            )}
            {isDevProOverrideAllowed && (
              <Pressable style={styles.replayTourButton} onPress={handleReplayOnboarding}>
                <Ionicons name="refresh-outline" size={16} color={colors.warning} />
                <Text style={[styles.replayTourText, { color: colors.warning }]}>
                  Ver splash + onboarding de nuevo (recarga la app)
                </Text>
              </Pressable>
            )}

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>APARIENCIA</Text>
            <View style={{ gap: 10 }}>
              {OPTIONS.map((option) => {
                const selected = preference === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.option,
                      { borderColor: colors.border },
                      selected && { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
                    ]}
                    onPress={() => setPreference(option.value)}
                  >
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={selected ? colors.accent : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: selected ? colors.accent : colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.accent} style={{ marginLeft: 'auto' }} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              ACERCA DE VERITY
            </Text>
            <View style={[styles.aboutCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.aboutHeader}>
                <Image source={APP_ICON} style={styles.aboutIcon} />
                <View>
                  <Text style={[styles.aboutTitle, { color: colors.text }]}>Verity</Text>
                  <Text style={[styles.aboutVersion, { color: colors.textMuted }]}>
                    Versión {APP_VERSION} · MVP Shipaton 2026
                  </Text>
                </View>
              </View>
              <Text style={[styles.aboutTagline, { color: colors.textMuted }]}>
                Notario digital para tus fotos y videos: huella digital SHA-256
                calculada en tu teléfono y registrada en un registro público,
                sin subir el archivo a ningún lado.
              </Text>

              {/* Las dos filas usan una columna de etiqueta de ancho FIJO
                  (styles.aboutRowLabel) para que el valor siempre empiece
                  en la misma X, sin importar si la etiqueta es "Red" o
                  "Wallet del dispositivo" — antes cada valor se alineaba
                  a la derecha por separado, así que "0x086e..." y
                  "Polygon Amoy" no empezaban en la misma columna. */}
              <View style={[styles.aboutRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.aboutRowLabel, { color: colors.textMuted }]}>Red</Text>
                <Text style={[styles.aboutRowValue, { color: colors.text }]}>Polygon Amoy (testnet)</Text>
              </View>

              {/* Único lugar de la app donde vive el estado del plan de
                  forma permanente (ver notas en CaptureScreen.tsx y
                  StatsCard.tsx) — tocarlo abre el paywall. */}
              <Pressable
                style={[styles.aboutRow, { borderTopColor: colors.border }]}
                onPress={() => setPaywallVisible(true)}
              >
                <Text style={[styles.aboutRowLabel, { color: colors.textMuted }]}>Plan</Text>
                <View style={styles.aboutRowValueWrap}>
                  <Text style={[styles.aboutRowValue, { color: colors.text }]}>
                    {!usage ? '...' : usage.isPro ? 'PRO · ilimitado' : `Gratis · ${usage.used}/${usage.limit} este mes`}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </View>
              </Pressable>

              <Pressable
                style={[styles.aboutRow, { borderTopColor: colors.border }]}
                onPress={handleCopyWallet}
              >
                <Text style={[styles.aboutRowLabel, { color: colors.textMuted }]}>
                  Wallet del dispositivo
                </Text>
                <View style={styles.aboutRowValueWrap}>
                  <Text style={[styles.aboutRowValue, { color: colors.text, fontFamily: 'monospace' }]}>
                    {walletAddress ? truncateAddress(walletAddress) : '...'}
                  </Text>
                  <Ionicons
                    name={copied ? 'checkmark-circle' : 'copy-outline'}
                    size={15}
                    color={copied ? colors.success : colors.accent}
                  />
                </View>
              </Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              RESPALDO DE LA WALLET
            </Text>
            <Text style={[styles.walletHint, { color: colors.textMuted }]}>
              Si borras los datos de la app o cambias de teléfono, se pierde la wallet y con ella
              la posibilidad de sellar con esta misma identidad. Un respaldo es la única forma de
              recuperarla.
            </Text>
            <View style={[styles.aboutCard, { backgroundColor: colors.background, borderColor: colors.border, padding: 4 }]}>
              <Pressable style={styles.legalRow} onPress={handleBackupWallet}>
                <Text style={[styles.legalRowLabel, { color: colors.text }]}>Respaldar mi wallet</Text>
                <Ionicons name="download-outline" size={18} color={colors.textMuted} />
              </Pressable>
              <Pressable
                style={[styles.legalRow, { borderTopWidth: 1, borderTopColor: colors.border }]}
                onPress={handleRestoreWallet}
              >
                <Text style={[styles.legalRowLabel, { color: colors.text }]}>Restaurar desde respaldo</Text>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              VERIFICACIÓN PÚBLICA
            </Text>
            <Text style={[styles.walletHint, { color: colors.textMuted }]}>
              El envío automático al índice público (para que "por archivo"
              funcione en{' '}
              <Text style={{ fontWeight: '700' }}>josequevedov08.github.io/Verity-MVP</Text>
              {' '}sin instalar la app) empezó en la versión 0.3.3 — si sellaste
              algo antes de eso, tócalo para que aparezca también.
            </Text>
            <View style={[styles.aboutCard, { backgroundColor: colors.background, borderColor: colors.border, padding: 4 }]}>
              <Pressable style={styles.legalRow} onPress={handleSyncPublicIndex} disabled={syncingIndex}>
                <Text style={[styles.legalRowLabel, { color: colors.text }]}>
                  {syncingIndex ? 'Sincronizando...' : 'Sincronizar con el índice público'}
                </Text>
                {syncingIndex ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="sync-outline" size={18} color={colors.textMuted} />
                )}
              </Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              LEGAL Y AYUDA
            </Text>
            <View style={[styles.aboutCard, { backgroundColor: colors.background, borderColor: colors.border, padding: 4 }]}>
              {(Object.keys(LEGAL_DOCS) as LegalDocId[]).map((id, index) => (
                <Pressable
                  key={id}
                  style={[
                    styles.legalRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                  onPress={() => setOpenDoc(id)}
                >
                  <Text style={[styles.legalRowLabel, { color: colors.text }]}>{LEGAL_DOCS[id].title}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.replayTourButton} onPress={handleReplayTour}>
              <Ionicons name="play-circle-outline" size={16} color={colors.accent} />
              <Text style={[styles.replayTourText, { color: colors.accent }]}>Ver la guía de nuevo</Text>
            </Pressable>

        </ScrollView>
      </SafeAreaView>

      <LegalContentModal docId={openDoc} onClose={() => setOpenDoc(null)} />

      <PaywallModal
        visible={paywallVisible}
        usage={usage}
        onClose={() => setPaywallVisible(false)}
        onPurchased={() => {
          setPaywallVisible(false);
          getSealUsage().then(setUsage);
          Alert.alert('¡Listo!', 'Ya eres PRO: sellos ilimitados.');
        }}
      />
    </Modal>
  );
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800' },
  closeText: { fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  // Círculo con relieve detrás del ícono (fondo blanco translúcido +
  // sombra propia) — en vez del ícono plano flotando directo sobre el
  // degradado, que se sentía "plástico"/sin profundidad.
  proBannerBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBannerText: { flex: 1 },
  proBannerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  proBannerSubtitle: { fontSize: 11.5, fontWeight: '600', marginTop: 3, color: 'rgba(255,255,255,0.9)', lineHeight: 15 },
  proBannerUsageRow: { flexDirection: 'row', marginTop: 8 },
  proBannerUsagePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  proBannerUsageText: { fontSize: 10.5, fontWeight: '700', color: '#fff' },
  proBannerCta: { alignItems: 'center' },
  proBannerPrice: { fontSize: 20, fontWeight: '800', color: '#fff' },
  proBannerPricePeriod: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  restoreLink: { alignItems: 'center', marginBottom: 20, marginTop: -8 },
  restoreLinkText: { fontSize: 12.5, fontWeight: '700' },
  devBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  devBoxTitle: { fontSize: 12.5, fontWeight: '800', marginBottom: 3 },
  devBoxText: { fontSize: 11.5, lineHeight: 15 },
  sectionLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  subtitle: { fontSize: 13, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  aboutCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  aboutIcon: { width: 44, height: 44, borderRadius: 12 },
  aboutTitle: { fontSize: 16, fontWeight: '800' },
  aboutVersion: { fontSize: 11, marginTop: 2 },
  aboutTagline: { fontSize: 12.5, lineHeight: 18 },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  // Ancho fijo: así el valor de CUALQUIER fila empieza siempre en la
  // misma columna, sin importar cuánto mida el texto de la etiqueta.
  aboutRowLabel: { fontSize: 12.5, fontWeight: '600', width: 128 },
  aboutRowValue: { fontSize: 12.5 },
  aboutRowValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  legalRowLabel: { fontSize: 13.5, fontWeight: '600' },
  walletHint: { fontSize: 11.5, lineHeight: 16, marginBottom: 10 },
  replayTourButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  replayTourText: { fontSize: 13, fontWeight: '700' },
});
