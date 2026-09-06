/**
 * CertificatesScreen.tsx
 * ---------------------------------------------------------------------------
 * Pestaña "Mis sellos": historial local de todo lo que el usuario ha
 * sellado en este dispositivo. Se lee de AsyncStorage (cryptoUtils.ts),
 * no de ningún servidor.
 */
import React, { useCallback, useState } from 'react';
import { FlatList, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import CertificateCard from '../components/CertificateCard';
import { getCertificates } from '../utils/cryptoUtils';
import type { VerityCertificate } from '../../documentation/technical/verity-protocol';

export default function CertificatesScreen() {
  const [certificates, setCertificates] = useState<VerityCertificate[]>([]);

  // Recarga el historial cada vez que se entra a esta pestaña, para
  // reflejar sellos hechos recién en "Sellar".
  useFocusEffect(
    useCallback(() => {
      getCertificates().then(setCertificates);
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mis sellos</Text>
      <FlatList
        data={certificates}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CertificateCard certificate={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Todavía no has sellado ninguna foto.</Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  empty: { color: '#888', marginTop: 40, textAlign: 'center' },
});
