/**
 * Patient Take-home Medications Screen
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Header, Badge } from '../../src/components';
import {
  medicationAdherenceService,
  TakeHomeMedication,
  AdherenceSummary,
} from '../../src/services/medicationAdherenceService';

export default function PatientMedicationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [medications, setMedications] = useState<TakeHomeMedication[]>([]);
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [meds, adh] = await Promise.all([
        medicationAdherenceService.getMyMedications(),
        medicationAdherenceService.getAdherence(),
      ]);
      setMedications(meds);
      setAdherence(adh);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleTaken = async (medId: string) => {
    try {
      await medicationAdherenceService.logMedication(medId, {});
      Alert.alert('Logged', 'Medication marked as taken.');
      loadData();
    } catch {
      Alert.alert('Error', 'Could not log medication.');
    }
  };

  const handleSkipped = (medId: string) => {
    Alert.alert('Skip Medication', 'Why are you skipping?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Side effects',
        onPress: () => logSkip(medId, 'Side effects'),
      },
      {
        text: 'Forgot',
        onPress: () => logSkip(medId, 'Forgot'),
      },
      {
        text: 'Other',
        onPress: () => logSkip(medId, 'Other'),
      },
    ]);
  };

  const logSkip = async (medId: string, reason: string) => {
    try {
      await medicationAdherenceService.logMedication(medId, { skipped: true, skipReason: reason });
      Alert.alert('Logged', 'Medication marked as skipped.');
      loadData();
    } catch {
      Alert.alert('Error', 'Could not log medication.');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="My Medications" showBackButton onBackPress={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="My Medications" showBackButton onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Adherence Summary */}
        {adherence && (
          <Card variant="elevated" padding="medium" style={styles.card}>
            <Text style={styles.sectionTitle}>Adherence</Text>
            <View style={styles.adherenceRow}>
              <View style={styles.adherenceStat}>
                <Text style={styles.adherenceValue}>{adherence.adherenceRate}%</Text>
                <Text style={styles.adherenceLabel}>Overall</Text>
              </View>
              <View style={styles.adherenceStat}>
                <Text style={[styles.adherenceValue, { color: colors.success }]}>{adherence.taken}</Text>
                <Text style={styles.adherenceLabel}>Taken</Text>
              </View>
              <View style={styles.adherenceStat}>
                <Text style={[styles.adherenceValue, { color: colors.warning }]}>{adherence.skipped}</Text>
                <Text style={styles.adherenceLabel}>Skipped</Text>
              </View>
              <View style={styles.adherenceStat}>
                <Text style={[styles.adherenceValue, { color: colors.error }]}>{adherence.missed}</Text>
                <Text style={styles.adherenceLabel}>Missed</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Medication List */}
        <Text style={styles.sectionTitle}>Today's Medications</Text>
        {medications.length === 0 ? (
          <Card variant="default" padding="large" style={styles.card}>
            <View style={styles.center}>
              <Ionicons name="medical-outline" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>No take-home medications</Text>
              <Text style={styles.emptySubtext}>
                Medications will appear here after your treatment sessions
              </Text>
            </View>
          </Card>
        ) : (
          medications.map(med => (
            <Card key={med.id} variant="default" padding="medium" style={styles.card}>
              <View style={styles.medHeader}>
                <View style={styles.medIcon}>
                  <Ionicons name="medical" size={20} color={colors.primary[500]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{med.drugName}</Text>
                  <Text style={styles.medDetail}>
                    {med.dose} {med.unit} {med.route ? `(${med.route})` : ''}
                  </Text>
                  {med.frequency && <Text style={styles.medFreq}>{med.frequency}</Text>}
                </View>
                <Badge label={med.isActive ? 'Active' : 'Done'} variant={med.isActive ? 'success' : 'neutral'} size="small" />
              </View>
              {med.instructions && (
                <Text style={styles.instructions}>{med.instructions}</Text>
              )}
              {med.isActive && (
                <View style={styles.medActions}>
                  <TouchableOpacity style={styles.takenBtn} onPress={() => handleTaken(med.id)}>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.takenBtnText}>Taken</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.skipBtn} onPress={() => handleSkipped(med.id)}>
                    <Ionicons name="close-circle-outline" size={18} color={colors.warning} />
                    <Text style={styles.skipBtnText}>Skip</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  card: { marginBottom: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  adherenceRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  adherenceStat: { alignItems: 'center' },
  adherenceValue: { fontSize: 24, fontWeight: '700', color: colors.primary[500] },
  adherenceLabel: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  medIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  medName: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  medDetail: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  medFreq: { fontSize: 12, color: colors.primary[500], marginTop: 2 },
  instructions: { fontSize: 13, color: colors.text.secondary, marginTop: spacing.sm, fontStyle: 'italic', paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.primary[200] },
  medActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light },
  takenBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, borderRadius: borderRadius.md, padding: spacing.sm, gap: 4 },
  takenBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  skipBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.warning, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 4 },
  skipBtnText: { fontSize: 14, fontWeight: '500', color: colors.warning },
  emptyText: { fontSize: 16, fontWeight: '500', color: colors.text.secondary, marginTop: spacing.md },
  emptySubtext: { fontSize: 13, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.lg },
});
