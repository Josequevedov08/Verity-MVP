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

export type LegalDocId = 'privacy' | 'terms' | 'faq';

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
  privacy: {
    title: 'Política de privacidad',
    updated: 'Última actualización: septiembre de 2026',
    sections: [
      {
        heading: 'Qué NO hace Verity',
        body: 'Verity no tiene servidor propio, no pide cuenta ni login, y nunca sube tu foto ni tu video a ningún sitio. No hay analítica de terceros ni publicidad en esta versión.',
      },
      {
        heading: 'Qué se procesa en tu teléfono',
        body: 'Al sellar una foto o video, Verity calcula su huella digital (hash SHA-256) directamente en tu dispositivo. El archivo original nunca sale de tu teléfono — solo esa huella (un texto de 64 caracteres, no reversible a la imagen original) se envía a la red pública de Polygon para quedar registrada con fecha y hora.',
      },
      {
        heading: 'Qué se guarda y dónde',
        body: 'El historial de sellos (miniaturas, fechas, número de sello) se guarda únicamente en el almacenamiento local de tu teléfono. Si desinstalas la app o borras sus datos, ese historial local se pierde — pero los sellos ya anclados en Polygon siguen existiendo ahí para siempre y se pueden volver a consultar con "Buscar por número de sello". Puedes exportar una copia de seguridad de tu historial (sin fotos, solo hashes y metadatos) desde "Mis sellos".',
      },
      {
        heading: 'Permisos que pide la app',
        body: '• Cámara: para tomar la foto o grabar el video que vas a sellar.\n• Ubicación: solo cuando usas la cámara de la app (no para archivos de galería), para poder darle el nivel de confianza más alto a esa captura. Puedes negar este permiso y seguir usando la app con un nivel de confianza menor.\n• Fotos/galería: solo cuando tú eliges explícitamente sellar o verificar un archivo existente.',
      },
      {
        heading: 'Blockchain y wallet',
        body: 'Verity crea automáticamente una wallet en tu dispositivo (no visible como billetera cripto tradicional) solo para poder anclar hashes en Polygon Amoy, una red de pruebas (testnet) sin valor monetario real durante este MVP. La dirección de esa wallet es pública por diseño (así funciona cualquier blockchain) — la puedes ver en Ajustes.',
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
        body: 'Esta versión ancla los sellos en Polygon Amoy, una red de PRUEBAS. No tiene valor monetario real y puede reiniciarse o descontinuarse en cualquier momento por parte de Polygon — los sellos hechos aquí son una demostración funcional, no un registro permanente de producción. Al pasar a una red principal (mainnet) en el futuro, los sellos de esta versión de prueba no se migran automáticamente.',
      },
      {
        heading: 'Nivel de confianza, no una garantía legal',
        body: 'El "nivel de confianza" (Alta/Media/Baja) es una estimación automática basada en cómo se obtuvo el archivo (cámara propia con GPS y hora, galería con metadatos, o sin metadatos). No es una certificación legal ni pericial — es una señal para ayudarte a ti y a quien verifique el sello a entender qué tan sólida es la evidencia de origen.',
      },
      {
        heading: 'Responsabilidad del usuario',
        body: 'Eres responsable del contenido que sellas. Verity no revisa ni modera lo que sellas — solo calcula y ancla su huella digital.',
      },
      {
        heading: 'Plan gratuito y Pro (futuro)',
        body: 'El plan gratuito de Verity incluye un número limitado de sellos por mes. Un plan Pro (de pago, gestionado a través de RevenueCat) podrá levantar ese límite. Estos términos se actualizarán cuando esa función esté disponible.',
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
        body: 'Pierdes el historial local (miniaturas, fechas). Pero cada sello que hiciste sigue existiendo en Polygon para siempre — puedes recuperarlo buscando su número de sello desde cualquier teléfono, en "Verificar". Por eso conviene exportar una copia de seguridad de tu historial de vez en cuando.',
      },
      {
        heading: '¿Qué significa el nivel de confianza (Alta/Media/Baja)?',
        body: 'Alta: se tomó con la cámara de Verity y se pudo verificar ubicación y hora. Media: viene de tu galería pero trae metadatos verificables (o es un video, que no trae ese tipo de metadato). Baja: no hay metadatos que respalden el origen del archivo.',
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
