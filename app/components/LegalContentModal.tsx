/**
 * LegalContentModal.tsx
 * ---------------------------------------------------------------------------
 * Modal de pantalla completa para mostrar un documento de texto largo
 * (política de privacidad, términos de uso, preguntas frecuentes). Se
 * usa desde SettingsModal → sección "Legal y ayuda".
 *
 * El contenido de los 3 documentos vive aquí mismo (LEGAL_DOCS), escrito
 * específicamente para lo que Verity realmente hace en este MVP — no es
 * texto genérico de relleno: sin cuentas, sin servidor propio, todo el
 * historial vive en el teléfono, y lo único que sale del dispositivo es
 * el hash SHA-256 (nunca la foto/video) anclado en Polygon Amoy.
 */
import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

export type LegalDocId = 'usage' | 'privacy' | 'terms' | 'faq';

interface LegalSection {
  heading: string;
  body: string;
}

interface LegalDoc {
  title: string;
  updated: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  usage: {
    title: 'Modo de uso',
    updated: '',
    sections: [
      {
        heading: 'Sellar',
        body: 'Toca "Tomar foto" o "Grabar video" para capturar algo nuevo con la cámara de Verity (el nivel de confianza más alto, porque se verifica GPS y hora reales), o "Galería" para sellar algo que ya tenías. En unos segundos obtienes un certificado con su nivel de confianza.',
      },
      {
        heading: 'Mis sellos',
        body: 'Arriba de todo verás cuántos sellos tienes en este teléfono (ej. "18 sellos") y su desglose por nivel de confianza: Alta (verde), Media (ámbar) y Baja (gris). Esto NO dice si tus fotos/videos son reales o falsos, solo qué tanta información hay disponible sobre cómo se tomaron (toca la insignia de confianza dentro de cualquier certificado para más detalle). Debajo, toca el ícono junto al engranaje para cambiar entre lista y grilla. Toca cualquier certificado para ver el detalle completo, y toca la CARTA (no la lista) para verla girar y mostrar la foto o reproducir el video real. Desliza el dedo dentro del detalle para pasar al sello anterior/siguiente.',
      },
      {
        heading: 'Verificar',
        body: 'Dos formas de comprobar algo: "Por archivo" (eliges una foto/video y Verity revisa sola si ya la sellaste) o "Por número de sello" (pegas un número de sello que te haya compartido alguien, y se consulta directo en el registro público, sin necesitar el archivo).',
      },
      {
        heading: 'Copia de seguridad',
        body: 'Desde "Mis sellos", "Exportar copia de seguridad" guarda tu historial local (sin fotos, solo hashes y fechas) para poder restaurarlo si cambias de teléfono o desinstalas la app.',
      },
    ],
  },
  privacy: {
    title: 'Política de privacidad',
    updated: 'Última actualización: septiembre de 2026',
    sections: [
      {
        heading: 'Qué NO hace Verity',
        body: 'Verity no pide cuenta ni login, no vende tus datos, y nunca sube tu foto ni tu video original a ningún sitio (ver "Qué se procesa en tu teléfono" abajo para el detalle de qué sí sale del dispositivo). No hay analítica de terceros ni publicidad en esta versión.',
      },
      {
        heading: 'Qué se procesa en tu teléfono',
        body: 'Al sellar una foto o video, Verity calcula su huella digital (hash SHA-256) directamente en tu dispositivo. El archivo original nunca sale de tu teléfono: solo esa huella (un texto de 64 caracteres, no reversible a la imagen original) se envía a la red pública de Polygon para quedar registrada con fecha y hora.',
      },
      {
        heading: 'Qué se guarda y dónde',
        body: 'El historial de sellos (miniaturas, fechas, número de sello) se guarda únicamente en el almacenamiento local de tu teléfono. Si desinstalas la app o borras sus datos, ese historial local se pierde, pero los sellos ya anclados en Polygon siguen existiendo ahí para siempre y se pueden volver a consultar con "Buscar por número de sello". Puedes exportar una copia de seguridad de tu historial (sin fotos, solo hashes y metadatos) desde "Mis sellos".',
      },
      {
        heading: 'Índice público de verificación',
        body: 'Para que alguien pueda verificar un archivo sellado en OTRO dispositivo sin tener el número de sello a mano, Verity envía a un servidor propio del proyecto (no de un tercero) el hash SHA-256, el número de transacción, la dirección de la wallet, el nivel de confianza, el tipo de archivo (foto o video) y la fecha de sellado. Nunca se envía el archivo original ni una miniatura. Este servidor solo acepta datos que ya puede confirmar como reales consultando directamente la blockchain, así que no depende de la palabra de nadie.',
      },
      {
        heading: 'Permisos que pide la app',
        body: '• Cámara: para tomar la foto o grabar el video que vas a sellar.\n• Ubicación: solo cuando usas la cámara de la app (no para archivos de galería), para poder darle el nivel de confianza más alto a esa captura. Puedes negar este permiso y seguir usando la app con un nivel de confianza menor.\n• Fotos/galería: solo cuando tú eliges explícitamente sellar o verificar un archivo existente, o para guardar ahí la copia de lo que sellas con la cámara.',
      },
      {
        heading: 'Blockchain y wallet',
        body: 'Verity crea automáticamente una wallet en tu dispositivo (no visible como billetera cripto tradicional) solo para poder anclar hashes en Polygon Amoy, una red de pruebas (testnet) sin valor monetario real durante este MVP. La dirección de esa wallet es pública por diseño (así funciona cualquier blockchain). La puedes ver en Ajustes.',
      },
      {
        heading: 'Pagos y suscripción PRO',
        body: 'Si te haces PRO, el pago lo procesa Google Play directamente. RevenueCat, un proveedor externo, gestiona el estado de tu suscripción (si está activa, cuándo se renueva) para que Verity sepa que eres PRO; no ve el contenido de tus fotos ni videos, solo datos de la suscripción en sí.',
      },
      {
        heading: 'Menores de edad',
        body: 'Verity no está dirigida a menores de 13 años y no recopila a sabiendas información de menores de esa edad.',
      },
      {
        heading: 'Cambios a esta política',
        body: 'Esta política puede actualizarse mientras el proyecto evoluciona más allá del MVP del hackathon. La fecha de la última actualización aparece arriba de todo.',
      },
      {
        heading: 'Contacto',
        body: 'Este es un proyecto MVP para el hackathon Shipaton 2026. Para preguntas sobre privacidad, escribe a joseramonquevedovillalobos@gmail.com.',
      },
    ],
  },
  terms: {
    title: 'Términos de uso',
    updated: 'Última actualización: septiembre de 2026',
    sections: [
      {
        heading: 'Qué es Verity',
        body: 'Verity es un notario digital: calcula la huella digital de tus fotos y videos y la registra en un registro público (blockchain), para poder demostrar más adelante que ese archivo exacto existía en un momento dado y no fue alterado desde entonces.',
      },
      {
        heading: 'Versión de prueba (testnet)',
        body: 'Esta versión ancla los sellos en Polygon Amoy, una red de PRUEBAS. No tiene valor monetario real y puede reiniciarse o descontinuarse en cualquier momento por parte de Polygon. Los sellos hechos aquí son una demostración funcional, no un registro permanente de producción. Al pasar a una red principal (mainnet) en el futuro, los sellos de esta versión de prueba no se migran automáticamente.',
      },
      {
        heading: 'Nivel de confianza, no una garantía legal',
        body: 'El "nivel de confianza" (Alta/Media/Baja) es una estimación automática basada en cómo se obtuvo el archivo (cámara propia con GPS y hora, galería con metadatos, o sin metadatos). No es una certificación legal ni pericial: es una señal para ayudarte a ti y a quien verifique el sello a entender qué tan sólida es la evidencia de origen.',
      },
      {
        heading: 'Responsabilidad del usuario',
        body: 'Eres responsable del contenido que sellas. Verity no revisa ni modera lo que sellas, solo calcula y ancla su huella digital.',
      },
      {
        heading: 'Plan gratuito y PRO',
        body: 'El plan gratuito incluye un número limitado de sellos por mes (ver la app para el número actual). Verity PRO ($4.99/mes, gestionado a través de RevenueCat y la Google Play Store) lo deja ilimitado. La suscripción se renueva automáticamente cada mes hasta que la canceles. Puedes cancelarla en cualquier momento desde la Play Store, sin permanencia ni penalidad; seguirá activa hasta el final del período ya pagado.',
      },
      {
        heading: 'Cómo se identifica quién es PRO (sin cuenta)',
        body: 'Verity no pide cuenta ni login, así que tu suscripción se identifica con un ID guardado en tu teléfono, vinculado a tu cuenta de Google Play. Si borras los datos de la app, la desinstalas, o cambias de teléfono, ese ID se pierde: usa "Restaurar compra" (en Ajustes o en la pantalla de PRO) para recuperar tu suscripción; funciona mientras sigas usando la MISMA cuenta de Google Play. Esto es igual en cualquier app con este modelo (Spotify, Netflix, etc.), no es una limitación exclusiva de Verity. Si cambias de cuenta de Google sin restaurar antes, no hay forma automática de recuperarla; en ese caso escríbenos con tu recibo de compra de Google Play.',
      },
      {
        heading: 'Cambios',
        body: 'Estos términos pueden actualizarse mientras el proyecto evoluciona más allá del MVP del hackathon.',
      },
    ],
  },
  faq: {
    title: 'Preguntas frecuentes',
    updated: '',
    sections: [
      {
        heading: '¿Verity sube mi foto o video a internet?',
        body: 'No. Solo su huella digital (un hash, no reversible a la imagen) se registra en la blockchain. El archivo se queda en tu teléfono.',
      },
      {
        heading: '¿Qué pasa si pierdo el teléfono o desinstalo la app?',
        body: 'Pierdes el historial local (miniaturas, fechas). Pero cada sello que hiciste sigue existiendo en Polygon para siempre: puedes recuperarlo buscando su número de sello desde cualquier teléfono, en "Verificar". Por eso conviene exportar una copia de seguridad de tu historial de vez en cuando.',
      },
      {
        heading: '¿"Confianza Baja" quiere decir que mi foto es falsa?',
        body: 'No, para nada. Alta/Media/Baja solo dice qué tanta información extra tenemos sobre CÓMO se tomó la foto o video (por ejemplo, si sabemos dónde y a qué hora). No dice si el contenido es real o falso. Una foto tuya, 100% real, puede salir en "Baja" simplemente porque viene de tu galería y no trae esos datos extra (por ejemplo, si te la mandaron por WhatsApp). Eso no la invalida: el sello sigue siendo válido igual.',
      },
      {
        heading: 'Me hice PRO y ahora no me reconoce como PRO, ¿qué pasó?',
        body: 'Probablemente borraste los datos de la app, la reinstalaste, o cambiaste de teléfono. Como Verity no pide cuenta, tu suscripción vive vinculada a tu cuenta de Google Play, no a la app en sí. Ve a Ajustes (o a la pantalla de PRO) y toca "Restaurar compra": mientras sigas con la misma cuenta de Google Play, se reactiva sola.',
      },
      {
        heading: '¿Polygon Amoy es dinero real?',
        body: 'No. Es una red de pruebas (testnet) que se usa para desarrollar y probar aplicaciones antes de pasarlas a una red principal. No tiene ningún valor monetario.',
      },
      {
        heading: '¿Cómo verifico un sello que me compartieron?',
        body: 'En la pestaña "Verificar", usa "Por número de sello" y pega el número de sello (empieza con 0x...) que te compartieron. Verity lo busca directamente en el registro público, sin necesitar el archivo.',
      },
      {
        heading: '¿Verity funciona con fotos Y videos?',
        body: 'Sí, ambos se pueden sellar y verificar igual. Para video se extrae además un frame como vista previa, y puedes reproducirlo tocando la carta del certificado.',
      },
      {
        heading: 'Si dos personas dicen que el mismo sello es suyo, ¿a quién le cree Verity?',
        body: 'Verity prueba qué archivo existía y en qué momento exacto, y qué wallet lo selló. No prueba quién es la persona real detrás de esa wallet (no hay cuentas ni cédula, es anónima por diseño). Es como un notario que certifica que algo pasó en un momento dado, pero no verifica la identidad de quien firma. Si eso se pusiera en duda, hace falta evidencia adicional fuera de la app (quién tenía el teléfono, testigos, un perito). El README del proyecto en GitHub tiene una sección con varios casos reales explicados uno por uno ("Casos reales: qué prueba Verity, qué no, y de qué no es responsable").',
      },
    ],
  },
};

export default function LegalContentModal({
  docId,
  onClose,
}: {
  docId: LegalDocId | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const doc = docId ? LEGAL_DOCS[docId] : null;

  return (
    <Modal visible={!!docId} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.page, { backgroundColor: colors.surface }]}>
        <View style={styles.topBar}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {doc?.title}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.closeText, { color: colors.accent }]}>Cerrar ✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {doc?.updated ? (
            <Text style={[styles.updated, { color: colors.textMuted }]}>{doc.updated}</Text>
          ) : null}
          {doc?.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={[styles.heading, { color: colors.text }]}>{section.heading}</Text>
              <Text style={[styles.body, { color: colors.textMuted }]}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  closeText: { fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  updated: { fontSize: 11.5, fontStyle: 'italic', marginBottom: 16 },
  section: { marginBottom: 20 },
  heading: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  body: { fontSize: 13.5, lineHeight: 20 },
});
