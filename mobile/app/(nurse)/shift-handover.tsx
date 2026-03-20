/**
 * Nurse Shift Handover Screen
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Header, Card, Badge, Button } from '../../src/components';
import { nurseService } from '../../src/services/nurseService';

export default function ShiftHandoverScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoData, setAutoData] = useState<any>(null);
  const [latestHandover, setLatestHandover] = useState<any>(null);
  const [generalNotes, setGeneralNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shiftType, setShiftType] = useState('morning');

  const loadData = useCallback(async () => {
    try {
      const [auto, latest] = await Promise.all([
        nurseService.autoPopulateHandover().catch(() => null),
        nurseService.getLatestHandover().catch(() => null),
      ]);
      setAutoData(auto);
      setLatestHandover(latest);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await nurseService.createHandover({
        shiftDate: today,
        shiftType,
        patientsSummary: autoData?.patientsSummary || [],
        generalNotes: generalNotes || undefined,
      });
      Alert.alert('Success', 'Shift handover report submitted.');
      loadData();
      setGeneralNotes('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to submit handover.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!latestHandover) return;
    try {
      await nurseService.acknowledgeHandover(latestHandover.id);
      Alert.alert('Acknowledged', 'You have acknowledged the handover.');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to acknowledge.');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Shift Handover" showBackButton onBackPress={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Shift Handover" showBackButton onBackPress={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Latest Handover (if exists and not acknowledged) */}
        {latestHandover && !latestHandover.acknowledgedAt && (
          <Card variant="elevated" padding="medium" style={styles.card}>
            <View style={styles.handoverHeader}>
              <Ionicons name="document-text" size={24} color={Colors.warning} />
              <Text style={styles.handoverTitle}>Pending Handover</Text>
            </View>
            <Text style={styles.handoverDate}>
              {latestHandover.shiftDate} - {latestHandover.shiftType} shift
            </Text>
            {latestHandover.generalNotes && (
              <Text style={styles.handoverNotes}>{latestHandover.generalNotes}</Text>
            )}
            <Text style={styles.patientCount}>
              {(latestHandover.patientsSummary || []).length} patients in summary
            </Text>
            {(latestHandover.patientsSummary || []).map((p: any, i: number) => (
              <View key={i} style={styles.patientRow}>
                <Text style={styles.patientName}>{p.patientName || p.patient_name || 'Patient'}</Text>
                <Badge
                  label={p.appointmentStatus || p.appointment_status || 'unknown'}
                  variant={p.appointmentStatus === 'in_progress' ? 'success' : 'info'}
                  size="small"
                />
              </View>
            ))}
            <Button
              title="Acknowledge Handover"
              variant="primary"
              onPress={handleAcknowledge}
              style={styles.acknowledgeBtn}
            />
          </Card>
        )}

        {/* Create New Handover */}
        <Text style={styles.sectionTitle}>Create Handover Report</Text>

        {/* Shift Type */}
        <View style={styles.shiftRow}>
          {['morning', 'afternoon', 'night'].map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.shiftBtn, shiftType === type && styles.shiftBtnActive]}
              onPress={() => setShiftType(type)}
            >
              <Text style={[styles.shiftBtnText, shiftType === type && styles.shiftBtnTextActive]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Auto-populated patients */}
        <Card variant="default" padding="medium" style={styles.card}>
          <Text style={styles.cardTitle}>Current Patients ({autoData?.totalPatients || 0})</Text>
          {(autoData?.patientsSummary || []).length === 0 ? (
            <Text style={styles.emptyText}>No active patients found for today</Text>
          ) : (
            (autoData?.patientsSummary || []).map((p: any, i: number) => (
              <View key={i} style={styles.patientRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{p.patient_name || 'Patient'}</Text>
                  <Text style={styles.patientDetail}>
                    {p.appointment_type?.replace(/_/g, ' ')} - {p.appointment_status}
                    {p.drugs_completed != null && ` | Drugs: ${p.drugs_completed}/${p.drugs_total}`}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* General Notes */}
        <Text style={styles.inputLabel}>General Notes</Text>
        <TextInput
          style={styles.textArea}
          value={generalNotes}
          onChangeText={setGeneralNotes}
          placeholder="Add any important notes for the incoming shift..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
          <Text style={styles.submitBtnText}>
            {submitting ? 'Submitting...' : 'Submit Handover'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md, color: Colors.textPrimary, marginBottom: Spacing.md },
  handoverHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  handoverTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md, color: Colors.warning },
  handoverDate: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  handoverNotes: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textPrimary, marginTop: Spacing.sm, fontStyle: 'italic' },
  patientCount: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  shiftRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  shiftBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  shiftBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  shiftBtnText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  shiftBtnTextActive: { color: Colors.white },
  cardTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary, marginBottom: Spacing.sm },
  patientRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  patientName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm, color: Colors.textPrimary },
  patientDetail: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textTertiary },
  inputLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm, color: Colors.textPrimary, marginBottom: Spacing.xs },
  textArea: { backgroundColor: Colors.white, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textPrimary, minHeight: 100, marginBottom: Spacing.lg },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  submitBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
  acknowledgeBtn: { marginTop: Spacing.md },
});
