/**
 * Patient Detail — Complete clinical picture
 * The crown jewel screen. Everything about a patient in one scroll.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Header, Card, Badge, Avatar, Button } from '../../src/components';
import { doctorService, PatientDetailAPI } from '../../src/services/doctorService';
import { treatmentService } from '../../src/services/treatmentService';
import { labService, LabResult } from '../../src/services/labService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PatientDetailScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patient, setPatient] = useState<PatientDetailAPI | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!patientId) return;
    try {
      const [pat, plansData, vitalsData, symptomsData, notesData, labsData] = await Promise.all([
        doctorService.getPatientById(patientId),
        doctorService.getTreatmentPlans(patientId),
        doctorService.getPatientVitals(patientId, 5),
        doctorService.getPatientSymptoms(patientId, 5),
        doctorService.getNotes(patientId).catch(() => []),
        labService.listLabs(patientId, 5).catch(() => []),
      ]);
      setPatient(pat);
      setPlans(plansData);
      setVitals(vitalsData);
      setSymptoms(symptomsData);
      setNotes(notesData);
      setLabs(labsData);

      // Load cycles for active plan
      const activePlan = plansData.find((p: any) => p.status === 'active' || p.status === 'approved');
      if (activePlan) {
        try {
          const c = await treatmentService.getCycles(activePlan.id);
          setCycles(c);
        } catch {}
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Helpers
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '--';
  const formatDateTime = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '--';
  const getAge = (dob?: string) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null;
  const getStatusColor = (s: string) => {
    if (s === 'completed') return Colors.success;
    if (s === 'in_progress' || s === 'active') return Colors.info;
    if (s === 'cancelled') return Colors.error;
    if (s === 'approved') return Colors.primary;
    return Colors.textTertiary;
  };
  const activePlan = plans.find((p: any) => p.status === 'active' || p.status === 'approved');
  const completedCycles = cycles.filter((c: any) => c.status === 'completed').length;
  const totalCycles = activePlan?.plannedCycles || 0;
  const progress = totalCycles > 0 ? Math.round((completedCycles / totalCycles) * 100) : 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Patient" showBackButton onBackPress={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.container}>
        <Header title="Patient" showBackButton onBackPress={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="person-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.errorText}>Patient not found</Text>
        </View>
      </View>
    );
  }

  const age = getAge(patient.dateOfBirth);

  return (
    <View style={styles.container}>
      <Header title="Patient Profile" showBackButton onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ═══════════ HERO CARD ═══════════ */}
        <View style={styles.heroCard}>
          <View style={styles.heroGradient}>
            <Avatar name={`${patient.firstName} ${patient.lastName}`} size="xlarge" source={patient.profilePhotoUrl ? { uri: patient.profilePhotoUrl } : undefined} />
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{patient.firstName} {patient.lastName}</Text>
              <Text style={styles.heroMeta}>
                {age ? `${age}y` : ''}{patient.gender ? ` • ${patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}` : ''}
                {patient.bloodGroup ? ` • ${patient.bloodGroup}` : ''}
              </Text>
            </View>
          </View>
          {/* Diagnosis Banner */}
          {patient.cancerType && (
            <View style={styles.diagnosisBanner}>
              <Ionicons name="medical" size={18} color={Colors.error} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={styles.diagnosisLabel}>Diagnosis</Text>
                <Text style={styles.diagnosisValue}>
                  {patient.cancerType}{patient.cancerStage ? ` — Stage ${patient.cancerStage}` : ''}
                </Text>
                {patient.diagnosisDate && (
                  <Text style={styles.diagnosisDate}>Diagnosed {formatDate(patient.diagnosisDate)}</Text>
                )}
              </View>
            </View>
          )}
          {/* Quick stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{patient.heightCm ? `${patient.heightCm}` : '--'}</Text>
              <Text style={styles.statUnit}>cm</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{patient.weightKg ? `${Number(patient.weightKg).toFixed(1)}` : '--'}</Text>
              <Text style={styles.statUnit}>kg</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{patient.bsa ? `${Number(patient.bsa).toFixed(2)}` : '--'}</Text>
              <Text style={styles.statUnit}>BSA m²</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{completedCycles}/{totalCycles}</Text>
              <Text style={styles.statUnit}>Cycles</Text>
            </View>
          </View>
        </View>

        {/* ═══════════ QUICK ACTIONS ═══════════ */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/(doctor-opd)/notes', params: { patientId } })} accessibilityLabel="Clinical notes" accessibilityRole="button">
            <View style={[styles.actionIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="document-text" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.actionLabel}>Notes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/(doctor-opd)/patient-photos', params: { patientId } })} accessibilityLabel="Photos" accessibilityRole="button">
            <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="camera" size={20} color="#D97706" />
            </View>
            <Text style={styles.actionLabel}>Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/(doctor-opd)/discharge-summary', params: { cycleId: cycles.find((c: any) => c.status === 'completed')?.id || '' } })} accessibilityLabel="Discharge summary" accessibilityRole="button">
            <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="reader" size={20} color="#16A34A" />
            </View>
            <Text style={styles.actionLabel}>Discharge</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(doctor-opd)/ai')} accessibilityLabel="AI assistant" accessibilityRole="button">
            <View style={[styles.actionIcon, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="sparkles" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>AI</Text>
          </TouchableOpacity>
        </View>

        {/* ═══════════ TREATMENT PROGRESS ═══════════ */}
        {activePlan && (
          <Card variant="default" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}><Ionicons name="flask" size={18} color={Colors.primary} /></View>
              <Text style={styles.sectionTitle}>Treatment Progress</Text>
            </View>
            <Text style={styles.protocolName}>{activePlan.protocolName}</Text>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
            {/* Cycle timeline mini */}
            <View style={styles.cycleTimeline}>
              {cycles.slice(0, 8).map((c: any) => (
                <View key={c.id} style={styles.cycleDot}>
                  <View style={[styles.cycleDotInner, { backgroundColor: getStatusColor(c.status) }]}>
                    {c.status === 'completed' && <Ionicons name="checkmark" size={10} color="#fff" />}
                  </View>
                  <Text style={styles.cycleDotLabel}>C{c.cycleNumber}</Text>
                </View>
              ))}
            </View>
            {activePlan.aiRecommendations && (
              <View style={styles.aiInsight}>
                <Ionicons name="sparkles" size={14} color={Colors.primary} />
                <Text style={styles.aiInsightText} numberOfLines={2}>{activePlan.aiRecommendations}</Text>
              </View>
            )}
          </Card>
        )}

        {/* ═══════════ LATEST VITALS ═══════════ */}
        <Card variant="default" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FEE2E2' }]}><Ionicons name="heart" size={18} color={Colors.error} /></View>
            <Text style={styles.sectionTitle}>Latest Vitals</Text>
          </View>
          {vitals.length === 0 ? (
            <Text style={styles.emptyText}>No vitals recorded</Text>
          ) : (
            <>
              <View style={styles.vitalsGrid}>
                {[
                  { label: 'Temp', value: vitals[0].temperatureF ? `${Number(vitals[0].temperatureF).toFixed(1)}°F` : '--', icon: 'thermometer-outline', color: '#EF4444' },
                  { label: 'BP', value: vitals[0].bloodPressureSystolic ? `${vitals[0].bloodPressureSystolic}/${vitals[0].bloodPressureDiastolic}` : '--', icon: 'pulse-outline', color: '#3B82F6' },
                  { label: 'Pulse', value: vitals[0].pulseBpm ? `${vitals[0].pulseBpm}` : '--', icon: 'heart-outline', color: '#EC4899' },
                  { label: 'SpO2', value: vitals[0].oxygenSaturation ? `${vitals[0].oxygenSaturation}%` : '--', icon: 'water-outline', color: '#06B6D4' },
                  { label: 'Weight', value: vitals[0].weightKg ? `${Number(vitals[0].weightKg).toFixed(1)}kg` : '--', icon: 'scale-outline', color: '#F59E0B' },
                  { label: 'Pain', value: vitals[0].painScore != null ? `${vitals[0].painScore}/10` : '--', icon: 'alert-circle-outline', color: '#EF4444' },
                ].map((v, i) => (
                  <View key={i} style={styles.vitalCell}>
                    <Ionicons name={v.icon as any} size={16} color={v.color} />
                    <Text style={styles.vitalValue}>{v.value}</Text>
                    <Text style={styles.vitalLabel}>{v.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.recordedAt}>Recorded {formatDateTime(vitals[0].recordedAt)}</Text>
            </>
          )}
        </Card>

        {/* ═══════════ RECENT LABS ═══════════ */}
        {labs.length > 0 && (
          <Card variant="default" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#FEF3C7' }]}><Ionicons name="flask" size={18} color="#D97706" /></View>
              <Text style={styles.sectionTitle}>Recent Labs</Text>
            </View>
            {labs.slice(0, 3).map((lab, i) => (
              <View key={lab.id} style={[styles.labRow, i < 2 && styles.labRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.labTitle}>{lab.title}</Text>
                  <Text style={styles.labDate}>{formatDate(lab.labDate)}</Text>
                </View>
                <View style={styles.labParams}>
                  {Object.entries(lab.parameters || {}).slice(0, 3).map(([k, v]) => (
                    <View key={k} style={styles.labParam}>
                      <Text style={styles.labParamKey}>{k}</Text>
                      <Text style={styles.labParamVal}>{String(v)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* ═══════════ SYMPTOM HISTORY ═══════════ */}
        <Card variant="default" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FCE7F3' }]}><Ionicons name="alert-circle" size={18} color="#EC4899" /></View>
            <Text style={styles.sectionTitle}>Symptom History</Text>
          </View>
          {symptoms.length === 0 ? (
            <Text style={styles.emptyText}>No symptoms logged</Text>
          ) : (
            symptoms.slice(0, 4).map((s: any, i: number) => {
              const severity = s.aiAlertLevel || 'normal';
              const sevColor = severity === 'urgent' ? Colors.error : severity === 'monitor' ? Colors.warning : Colors.success;
              const scores = [
                s.nauseaScore != null && `Nausea: ${s.nauseaScore}`,
                s.fatigueScore != null && `Fatigue: ${s.fatigueScore}`,
                s.painScore != null && `Pain: ${s.painScore}`,
              ].filter(Boolean);
              const flags = [
                s.hasFever && 'Fever',
                s.hasMouthSores && 'Mouth sores',
                s.hasDiarrhea && 'Diarrhea',
                s.hasNumbness && 'Numbness',
              ].filter(Boolean);
              return (
                <View key={s.id} style={[styles.symptomRow, i < symptoms.length - 1 && styles.symptomBorder]}>
                  <View style={[styles.severityDot, { backgroundColor: sevColor }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.symptomDate}>{formatDateTime(s.recordedAt)}</Text>
                      <Badge label={severity} variant={severity === 'urgent' ? 'error' : severity === 'monitor' ? 'warning' : 'success'} size="small" />
                    </View>
                    {scores.length > 0 && <Text style={styles.symptomScores}>{scores.join(' • ')}</Text>}
                    {flags.length > 0 && <Text style={styles.symptomFlags}>{flags.join(', ')}</Text>}
                    {s.aiRecommendations && <Text style={styles.symptomAi} numberOfLines={1}>{s.aiRecommendations}</Text>}
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* ═══════════ CLINICAL NOTES ═══════════ */}
        <Card variant="default" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#EDE9FE' }]}><Ionicons name="document-text" size={18} color="#7C3AED" /></View>
            <Text style={styles.sectionTitle}>Clinical Notes</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(doctor-opd)/notes', params: { patientId } })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {notes.length === 0 ? (
            <Text style={styles.emptyText}>No clinical notes yet</Text>
          ) : (
            notes.slice(0, 3).map((n: any, i: number) => (
              <View key={n.id} style={[styles.noteRow, i < 2 && styles.noteRowBorder]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Badge label={n.noteType || 'clinical'} variant="info" size="small" />
                  {n.isPrivate && <Badge label="Private" variant="warning" size="small" />}
                  <Text style={styles.noteDate}>{formatDateTime(n.createdAt)}</Text>
                </View>
                <Text style={styles.noteContent} numberOfLines={2}>{n.content}</Text>
              </View>
            ))
          )}
          <Button title="Add Note" variant="outline" size="small" onPress={() => router.push({ pathname: '/(doctor-opd)/notes', params: { patientId } })} style={{ marginTop: Spacing.sm }} icon={<Ionicons name="add" size={16} color={Colors.primary} />} />
        </Card>

        {/* ═══════════ PATIENT INFO ═══════════ */}
        <Card variant="default" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#DBEAFE' }]}><Ionicons name="person" size={18} color="#3B82F6" /></View>
            <Text style={styles.sectionTitle}>Patient Information</Text>
          </View>
          {[
            { label: 'Date of Birth', value: formatDate(patient.dateOfBirth) },
            { label: 'Phone', value: patient.address || '--' },
            { label: 'Allergies', value: patient.allergies?.length ? patient.allergies.join(', ') : 'None known' },
            { label: 'Comorbidities', value: patient.comorbidities?.length ? patient.comorbidities.join(', ') : 'None' },
            { label: 'Emergency Contact', value: patient.emergencyContactName ? `${patient.emergencyContactName} (${patient.emergencyContactRelation || ''}) ${patient.emergencyContactPhone || ''}` : '--' },
            { label: 'Insurance', value: patient.insuranceProvider ? `${patient.insuranceProvider} — ${patient.insurancePolicyNumber || ''}` : 'Not provided' },
          ].map((item, i) => (
            <View key={i} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md, color: Colors.textSecondary, marginTop: Spacing.md },

  // Hero
  heroCard: { backgroundColor: Colors.white, marginBottom: Spacing.sm, ...Shadows.small },
  heroGradient: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  heroInfo: { flex: 1 },
  heroName: { fontFamily: Typography.fontFamily.bold, fontSize: 22, color: Colors.textPrimary },
  heroMeta: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  diagnosisBanner: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: Spacing.lg, marginBottom: Spacing.md, padding: Spacing.md, backgroundColor: '#FEF2F2', borderRadius: BorderRadius.md },
  diagnosisLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 11, color: Colors.error, textTransform: 'uppercase', letterSpacing: 0.5 },
  diagnosisValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md, color: '#991B1B', marginTop: 2 },
  diagnosisDate: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: '#B91C1C', marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNum: { fontFamily: Typography.fontFamily.bold, fontSize: 18, color: Colors.textPrimary },
  statUnit: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.border },

  // Actions
  actionsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  actionBtn: { flex: 1, alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, ...Shadows.small },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  actionLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 11, color: Colors.textPrimary },

  // Sections
  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  sectionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary, flex: 1 },
  seeAll: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.primary },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textTertiary, fontStyle: 'italic' },

  // Treatment
  protocolName: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md, color: Colors.primary, marginBottom: Spacing.sm },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBarBg: { flex: 1, height: 8, backgroundColor: Colors.backgroundTertiary, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: Colors.success, borderRadius: 4 },
  progressText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm, color: Colors.success, width: 40 },
  cycleTimeline: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.sm, flexWrap: 'wrap' },
  cycleDot: { alignItems: 'center' },
  cycleDotInner: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.backgroundTertiary },
  cycleDotLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 9, color: Colors.textTertiary, marginTop: 2 },
  aiInsight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, padding: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.md },
  aiInsightText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.primary, flex: 1 },

  // Vitals
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  vitalCell: { width: (SCREEN_WIDTH - Spacing.lg * 4 - Spacing.sm * 2) / 3, alignItems: 'center', paddingVertical: Spacing.sm, backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md },
  vitalValue: { fontFamily: Typography.fontFamily.bold, fontSize: 16, color: Colors.textPrimary, marginTop: 4 },
  vitalLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  recordedAt: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.textTertiary, marginTop: Spacing.sm, textAlign: 'right' },

  // Labs
  labRow: { paddingVertical: Spacing.sm },
  labRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  labTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm, color: Colors.textPrimary },
  labDate: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.textTertiary },
  labParams: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
  labParam: { alignItems: 'center' },
  labParamKey: { fontFamily: Typography.fontFamily.regular, fontSize: 10, color: Colors.textTertiary, textTransform: 'capitalize' },
  labParamVal: { fontFamily: Typography.fontFamily.bold, fontSize: 14, color: Colors.textPrimary },

  // Symptoms
  symptomRow: { flexDirection: 'row', paddingVertical: Spacing.sm, gap: Spacing.sm },
  symptomBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  symptomDate: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.textTertiary },
  symptomScores: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.textPrimary, marginTop: 2 },
  symptomFlags: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.warning, marginTop: 2 },
  symptomAi: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.primary, marginTop: 2, fontStyle: 'italic' },

  // Notes
  noteRow: { paddingVertical: Spacing.sm },
  noteRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  noteDate: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.textTertiary },
  noteContent: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textPrimary, lineHeight: 20 },

  // Info
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary, flex: 1 },
  infoValue: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.textPrimary, flex: 1.5, textAlign: 'right' },
});
