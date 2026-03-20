/**
 * Nurse Treatment Administration Screen
 *
 * Core screen for step-by-step chemotherapy administration:
 *   Step 1 - Pre-treatment checklist
 *   Step 2 - Drug administration with live timers
 *   Step 3 - Complete session and navigate to discharge summary
 *
 * Receives `cycleId` (required) and optional `patientId` via route params.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Header, Badge, Card } from '../../src/components';
import { treatmentService } from '../../src/services/treatmentService';
import { nurseService, type MedicationAPI } from '../../src/services/nurseService';
import type { TreatmentCycle, TreatmentPlan, DrugAdministration } from '../../src/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CycleInfo extends TreatmentCycle {
  treatmentPlan?: TreatmentPlan;
}

type Step = 'checklist' | 'administration' | 'complete';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return Colors.success;
    case 'started':
      return Colors.info;
    case 'paused':
      return Colors.warning;
    default:
      return Colors.textTertiary;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'prepared':
      return 'Prepared';
    case 'verified':
      return 'Verified';
    case 'started':
      return 'Started';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
};

const badgeVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'started':
      return 'info';
    case 'paused':
      return 'warning';
    case 'pending':
    case 'prepared':
    case 'verified':
      return 'neutral';
    default:
      return 'neutral';
  }
};

const formatElapsed = (ms: number): string => {
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
};

const getRouteIcon = (route: string): string => {
  if (route.includes('IV')) return 'water-outline';
  if (route.includes('PO') || route.includes('Oral')) return 'medical-outline';
  if (route.includes('SC')) return 'bandage-outline';
  return 'flask-outline';
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TreatmentAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cycleId, patientId } = useLocalSearchParams<{ cycleId: string; patientId?: string }>();

  // Data state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cycle, setCycle] = useState<CycleInfo | null>(null);
  const [plan, setPlan] = useState<TreatmentPlan | null>(null);
  const [drugs, setDrugs] = useState<DrugAdministration[]>([]);
  const [patientName, setPatientName] = useState('Patient');
  const [patientAge, setPatientAge] = useState<number>(55);

  // Step tracking
  const [step, setStep] = useState<Step>('checklist');

  // Pre-treatment checklist
  const [checklist, setChecklist] = useState({
    identityVerified: false,
    consentConfirmed: false,
    vitalsRecorded: false,
    labsReviewed: false,
    preMedsGiven: false,
  });

  // Feature 1: Lab results
  const [labValues, setLabValues] = useState({
    neutrophils: '',
    platelets: '',
    hemoglobin: '',
    wbc: '',
    gfr: '',
    creatinine: '',
  });
  const [labResult, setLabResult] = useState<any>(null);
  const [labSubmitting, setLabSubmitting] = useState(false);
  const [labsPassed, setLabsPassed] = useState(false);

  // Completion
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Timer tick
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!cycleId) return;
    try {
      const [cycleData, drugData] = await Promise.all([
        treatmentService.getCycle(cycleId),
        treatmentService.getDrugAdministrations(cycleId),
      ]);
      setCycle(cycleData as CycleInfo);
      setDrugs(drugData);

      // Try to load the treatment plan for protocol/patient info
      if (cycleData.treatmentPlanId) {
        try {
          const planData = await treatmentService.getTreatmentPlan(cycleData.treatmentPlanId);
          setPlan(planData);

          // Resolve patient name
          if (planData.patientId || patientId) {
            try {
              const patient = await nurseService.getPatientById(planData.patientId || patientId!);
              setPatientName(`${patient.firstName} ${patient.lastName}`);
              if (patient.dateOfBirth) {
                const dob = new Date(patient.dateOfBirth);
                setPatientAge(Math.floor((Date.now() - dob.getTime()) / 31557600000));
              }
            } catch {
              // keep default
            }
          }
        } catch {
          // plan fetch failed — non-critical
        }
      }

      // Auto-check vitals if cycle already has pre-chemo vitals
      if (cycleData.preChemoVitals && Object.keys(cycleData.preChemoVitals).length > 0) {
        setChecklist(prev => ({ ...prev, vitalsRecorded: true }));
      }

      // If the cycle is already in progress, skip to administration step
      if (cycleData.status === 'in_progress') {
        setStep('administration');
      } else if (cycleData.status === 'completed') {
        setStep('complete');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to load treatment data.');
    } finally {
      setLoading(false);
    }
  }, [cycleId, patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Timer for elapsed display
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // -------------------------------------------------------------------------
  // Checklist helpers
  // -------------------------------------------------------------------------

  const allChecked = Object.values(checklist).every(Boolean);

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStartTreatment = async () => {
    if (!allChecked) return;

    // CRITICAL: Block if labs didn't pass safety check
    if (!labsPassed) {
      Alert.alert('Labs Required', 'Pre-chemo lab results must be submitted and pass safety checks before starting treatment.');
      return;
    }

    try {
      // Start the cycle on the backend (backend also re-validates labs)
      await treatmentService.startCycle(cycleId!);
      setStep('administration');
      await loadData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to start treatment cycle.';
      Alert.alert('Cannot Start Treatment', detail);
      // DO NOT proceed to next step
    }
  };

  // -------------------------------------------------------------------------
  // Drug administration actions
  // -------------------------------------------------------------------------

  const handleStartDrug = async (drugId: string) => {
    try {
      await nurseService.startMedication(drugId);
      setDrugs(prev =>
        prev.map(d =>
          d.id === drugId ? { ...d, status: 'started' as any, startedAt: new Date().toISOString() } : d
        )
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to start drug administration.');
    }
  };

  const handleCompleteDrug = async (drugId: string) => {
    try {
      await nurseService.completeMedication(drugId);
      setDrugs(prev =>
        prev.map(d =>
          d.id === drugId ? { ...d, status: 'completed' as any, completedAt: new Date().toISOString() } : d
        )
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to complete drug administration.');
    }
  };

  const handleHoldDrug = (drugId: string, drugName: string) => {
    Alert.prompt
      ? Alert.prompt(
          'Hold Medication',
          `Provide reason for holding ${drugName}:`,
          async (reason: string) => {
            if (!reason?.trim()) return;
            try {
              await nurseService.pauseMedication(drugId, reason);
              setDrugs(prev =>
                prev.map(d =>
                  d.id === drugId ? { ...d, status: 'paused' as any, notes: reason } : d
                )
              );
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.detail || 'Failed to hold drug.');
            }
          },
          'plain-text',
          '',
        )
      : Alert.alert('Hold Medication', `Hold ${drugName}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Hold',
            style: 'destructive',
            onPress: async () => {
              try {
                await nurseService.pauseMedication(drugId, 'Held by nurse');
                setDrugs(prev =>
                  prev.map(d =>
                    d.id === drugId ? { ...d, status: 'paused' as any, notes: 'Held by nurse' } : d
                  )
                );
              } catch (err: any) {
                Alert.alert('Error', err?.response?.data?.detail || 'Failed to hold drug.');
              }
            },
          },
        ]);
  };

  // -------------------------------------------------------------------------
  // Complete session
  // -------------------------------------------------------------------------

  const allDrugsCompleted = drugs.length > 0 && drugs.every(d => d.status === 'completed');
  const completedCount = drugs.filter(d => d.status === 'completed').length;

  const handleCompleteTreatment = async () => {
    setCompleting(true);
    try {
      await treatmentService.completeCycle(cycleId!, dischargeNotes || undefined);
      router.replace({
        pathname: '/(nurse)/discharge-summary',
        params: { cycleId },
      });
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to complete treatment cycle.');
    } finally {
      setCompleting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderCheckItem = (label: string, key: keyof typeof checklist) => (
    <TouchableOpacity
      key={key}
      style={styles.checkItem}
      onPress={() => toggleCheck(key)}
      activeOpacity={0.6}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: checklist[key] }}
    >
      <View style={[styles.checkbox, checklist[key] && styles.checkboxChecked]}>
        {checklist[key] && <Ionicons name="checkmark" size={16} color={Colors.white} />}
      </View>
      <Text style={[styles.checkLabel, checklist[key] && styles.checkLabelChecked]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderDrugCard = (drug: DrugAdministration, index: number) => {
    const elapsed =
      drug.status === 'started' && drug.startedAt
        ? Date.now() - new Date(drug.startedAt).getTime()
        : null;

    return (
      <View key={drug.id} style={styles.drugCard}>
        <View style={styles.drugHeader}>
          <View style={styles.drugSeq}>
            <Text style={styles.drugSeqText}>{index + 1}</Text>
          </View>
          <View style={styles.drugInfo}>
            <Text style={styles.drugName}>{drug.drugName}</Text>
            <Text style={styles.drugMeta}>
              {drug.plannedDose} {drug.unit} {'\u2022'} {drug.route}
              {drug.plannedDurationMins ? ` \u2022 ${drug.plannedDurationMins} min` : ''}
            </Text>
          </View>
          <Badge label={statusLabel(drug.status)} variant={badgeVariant(drug.status)} size="small" />
        </View>

        {/* Timer for active drugs */}
        {elapsed !== null && (
          <View style={styles.timerRow}>
            <Ionicons name="timer-outline" size={18} color={Colors.info} />
            <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
            {drug.plannedDurationMins && (
              <Text style={styles.timerTarget}>/ {drug.plannedDurationMins} min</Text>
            )}
          </View>
        )}

        {/* Actions */}
        {(drug.status === 'pending' || drug.status === 'prepared' || drug.status === 'verified') && (
          <View style={styles.drugActions}>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => handleStartDrug(drug.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-circle-outline" size={18} color={Colors.white} />
              <Text style={styles.startBtnText}>Start</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.holdBtn}
              onPress={() => handleHoldDrug(drug.id, drug.drugName)}
              activeOpacity={0.7}
            >
              <Ionicons name="pause-circle-outline" size={18} color={Colors.warning} />
              <Text style={styles.holdBtnText}>Hold</Text>
            </TouchableOpacity>
          </View>
        )}

        {drug.status === 'started' && (
          <View style={styles.drugActions}>
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => handleCompleteDrug(drug.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />
              <Text style={styles.completeBtnText}>Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.holdBtn}
              onPress={() => handleHoldDrug(drug.id, drug.drugName)}
              activeOpacity={0.7}
            >
              <Ionicons name="pause-circle-outline" size={18} color={Colors.warning} />
              <Text style={styles.holdBtnText}>Hold</Text>
            </TouchableOpacity>
          </View>
        )}

        {drug.status === 'paused' && drug.notes && (
          <View style={styles.holdNoteRow}>
            <Ionicons name="alert-circle" size={14} color={Colors.warning} />
            <Text style={styles.holdNoteText}>Held: {drug.notes}</Text>
          </View>
        )}

        {drug.status === 'completed' && (
          <View style={styles.completedRow}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={styles.completedText}>
              Completed
              {drug.completedAt
                ? ` at ${new Date(drug.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // Loading / Error
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading treatment data...</Text>
      </View>
    );
  }

  if (!cycle) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header title="Treatment" showBackButton onBackPress={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.errorTitle}>Cycle Not Found</Text>
          <Text style={styles.errorText}>Unable to load treatment cycle data.</Text>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  const progressPercent = drugs.length > 0 ? (completedCount / drugs.length) * 100 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Treatment Admin" showBackButton onBackPress={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Patient & Protocol Header */}
        <View style={styles.patientHeader}>
          <View style={styles.patientAvatar}>
            <Ionicons name="person" size={28} color={Colors.primary} />
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{patientName}</Text>
            <Text style={styles.protocolName}>{plan?.protocolName || 'Treatment Protocol'}</Text>
            <Text style={styles.cycleLabel}>
              Cycle {cycle.cycleNumber}
              {plan?.plannedCycles ? ` of ${plan.plannedCycles}` : ''}
            </Text>
          </View>
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <StepBadge
            number={1}
            label="Checklist"
            active={step === 'checklist'}
            completed={step !== 'checklist'}
          />
          <View style={[styles.stepLine, step !== 'checklist' && styles.stepLineActive]} />
          <StepBadge
            number={2}
            label="Drugs"
            active={step === 'administration'}
            completed={step === 'complete'}
          />
          <View style={[styles.stepLine, step === 'complete' && styles.stepLineActive]} />
          <StepBadge
            number={3}
            label="Complete"
            active={step === 'complete'}
            completed={false}
          />
        </View>

        {/* =================== STEP 1: PRE-TREATMENT CHECKLIST =================== */}
        {step === 'checklist' && (
          <View style={styles.section}>
            {/* Feature 1: Lab Results Entry */}
            <Text style={styles.sectionTitle}>Pre-Chemo Lab Results</Text>
            <Card variant="default" padding="medium" style={styles.checklistCard}>
              {[
                { key: 'neutrophils', label: 'Neutrophils', unit: 'x10\u2079/L', min: 1.0 },
                { key: 'platelets', label: 'Platelets', unit: 'x10\u2079/L', min: 75 },
                { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', min: 8.0 },
                { key: 'wbc', label: 'WBC', unit: 'x10\u2079/L', min: null },
                { key: 'gfr', label: 'GFR', unit: 'mL/min', min: 30 },
                { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', min: null },
              ].map(param => {
                const val = labValues[param.key as keyof typeof labValues];
                const numVal = val ? parseFloat(val) : null;
                const isLow = param.min != null && numVal != null && !isNaN(numVal) && numVal < param.min;
                return (
                  <View key={param.key} style={styles.labRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.labLabel}>{param.label}</Text>
                      <Text style={styles.labUnit}>{param.unit}{param.min != null ? ` (min: ${param.min})` : ''}</Text>
                    </View>
                    <TextInput
                      style={[styles.labInput, isLow && styles.labInputDanger]}
                      value={val}
                      onChangeText={v => {
                        // Allow digits and dots for decimal entry
                        const cleaned = v.replace(/[^0-9.]/g, '');
                        setLabValues(prev => ({ ...prev, [param.key]: cleaned }));
                      }}
                      placeholder="--"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="numeric"
                    />
                    {isLow && (
                      <Ionicons name="warning" size={18} color={Colors.error} style={{ marginLeft: 6 }} />
                    )}
                    {numVal != null && !isNaN(numVal) && !isLow && param.min != null && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.success} style={{ marginLeft: 6 }} />
                    )}
                  </View>
                );
              })}

              {/* Creatinine Clearance Calculator */}
              {labValues.creatinine && parseFloat(labValues.creatinine) > 0 && (
                <View style={styles.crcalcBox}>
                  <Ionicons name="calculator" size={16} color={Colors.primary} />
                  <Text style={styles.crcalcText}>
                    Est. CrCl (Cockcroft-Gault):{' '}
                    <Text style={{ fontFamily: Typography.fontFamily.bold }}>
                      {(() => {
                        const cr = parseFloat(labValues.creatinine);
                        const weight = cycle?.patientWeightKg ? Number(cycle.patientWeightKg) : 70;
                        const age = patientAge;
                        const crcl = ((140 - age) * weight) / (72 * cr);
                        return `${crcl.toFixed(0)} mL/min`;
                      })()}
                    </Text>
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.labSubmitBtn, labSubmitting && { opacity: 0.5 }]}
                onPress={async () => {
                  if (!cycleId) return;
                  // Require at least neutrophils and platelets
                  if (!labValues.neutrophils || !labValues.platelets) {
                    Alert.alert('Required', 'At minimum, enter Neutrophils and Platelets values.');
                    return;
                  }
                  setLabSubmitting(true);
                  try {
                    const labs: any = {};
                    Object.entries(labValues).forEach(([k, v]) => {
                      if (v.trim()) labs[k] = parseFloat(v);
                    });
                    const result = await treatmentService.submitPreChemoLabs(cycleId, labs);
                    setLabResult(result);
                    if (result.canProceed) {
                      setLabsPassed(true);
                      setChecklist(prev => ({ ...prev, labsReviewed: true }));
                    } else {
                      setLabsPassed(false);
                      setChecklist(prev => ({ ...prev, labsReviewed: false }));
                      Alert.alert(
                        'TREATMENT BLOCKED',
                        'Lab values are outside safe range. Treatment cannot proceed.\n\nOptions:\n\u2022 Re-enter corrected lab values\n\u2022 Contact the treating doctor for override approval',
                        [
                          { text: 'Re-enter Labs', style: 'cancel' },
                          { text: 'Call Doctor', onPress: () => Linking.openURL('tel:18002436226') },
                        ]
                      );
                    }
                  } catch (err: any) {
                    Alert.alert('Error', err?.response?.data?.detail || 'Failed to submit labs.');
                  } finally {
                    setLabSubmitting(false);
                  }
                }}
                disabled={labSubmitting}
              >
                <Ionicons name="cloud-upload" size={18} color={Colors.white} />
                <Text style={styles.labSubmitText}>{labSubmitting ? 'Validating...' : 'Submit & Validate Labs'}</Text>
              </TouchableOpacity>

              {labResult && (
                <View style={[styles.labResultBox, { borderLeftWidth: 4, borderLeftColor: labResult.canProceed ? Colors.success : Colors.error }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name={labResult.canProceed ? 'checkmark-circle' : 'close-circle'} size={20} color={labResult.canProceed ? Colors.success : Colors.error} />
                    <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm, color: labResult.canProceed ? Colors.success : Colors.error }}>
                      {labResult.canProceed ? 'SAFE TO PROCEED' : 'TREATMENT BLOCKED'}
                    </Text>
                  </View>
                  {(labResult.safetyResults || []).map((r: any, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <Ionicons
                        name={r.status === 'block' ? 'close-circle' : r.status === 'warn' ? 'warning' : 'checkmark-circle'}
                        size={14}
                        color={r.status === 'block' ? Colors.error : r.status === 'warn' ? Colors.warning : Colors.success}
                      />
                      <Text style={{ fontSize: 12, color: r.status === 'block' ? Colors.error : r.status === 'warn' ? Colors.warning : Colors.textPrimary, flex: 1 }}>
                        {r.parameter}: {r.value} {r.status === 'ok' ? '\u2713' : `(min: ${r.threshold})`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            <Text style={styles.sectionTitle}>Pre-Treatment Checklist</Text>
            <Card variant="default" padding="medium" style={styles.checklistCard}>
              {renderCheckItem('Patient identity verified', 'identityVerified')}
              {renderCheckItem('Consent confirmed', 'consentConfirmed')}
              {renderCheckItem('Pre-chemo vitals recorded', 'vitalsRecorded')}
              {/* Labs reviewed is AUTO-SET by lab validation — not manually toggleable */}
              <View style={styles.checkItem}>
                <View style={[styles.checkbox, checklist.labsReviewed && styles.checkboxChecked]}>
                  {checklist.labsReviewed && <Ionicons name="checkmark" size={16} color={Colors.white} />}
                </View>
                <Text style={[styles.checkLabel, checklist.labsReviewed && styles.checkLabelChecked]}>
                  Lab results validated {labsPassed ? '\u2713' : '(submit labs above)'}
                </Text>
                {!labsPassed && <Ionicons name="lock-closed" size={14} color={Colors.textTertiary} />}
              </View>
              {renderCheckItem('All pre-medications given', 'preMedsGiven')}
            </Card>

            <TouchableOpacity
              style={[styles.primaryButton, !allChecked && styles.primaryButtonDisabled]}
              onPress={handleStartTreatment}
              disabled={!allChecked}
              activeOpacity={0.7}
            >
              <Ionicons name="play-circle" size={22} color={Colors.white} />
              <Text style={styles.primaryButtonText}>Start Treatment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* =================== STEP 2: DRUG ADMINISTRATION =================== */}
        {step === 'administration' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Drug Administration</Text>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressInfo}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={styles.progressCount}>
                  {completedCount} / {drugs.length} drugs
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>

            {/* Drug cards */}
            {drugs.length === 0 ? (
              <Card variant="default" padding="large" style={styles.emptyCard}>
                <Ionicons name="flask-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Drugs Found</Text>
                <Text style={styles.emptyText}>No drug administrations found for this cycle.</Text>
              </Card>
            ) : (
              drugs.map((drug, idx) => renderDrugCard(drug, idx))
            )}

            {/* Move to complete step */}
            {allDrugsCompleted && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setStep('complete')}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-forward-circle" size={22} color={Colors.white} />
                <Text style={styles.primaryButtonText}>Continue to Completion</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* =================== STEP 3: COMPLETE SESSION =================== */}
        {step === 'complete' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Complete Treatment Session</Text>

            {/* Summary */}
            <Card variant="default" padding="medium" style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.summaryText}>
                  All {drugs.length} drug{drugs.length !== 1 ? 's' : ''} administered
                </Text>
              </View>
              {drugs.map(drug => (
                <View key={drug.id} style={styles.summaryDrug}>
                  <Text style={styles.summaryDrugName}>{drug.drugName}</Text>
                  <Text style={styles.summaryDrugDose}>
                    {drug.actualDose ?? drug.plannedDose} {drug.unit}
                  </Text>
                </View>
              ))}
            </Card>

            {/* Discharge notes */}
            <Text style={styles.inputLabel}>Discharge Notes (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={dischargeNotes}
              onChangeText={setDischargeNotes}
              placeholder="Add any discharge notes, observations, or follow-up instructions..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.primaryButton, completing && styles.primaryButtonDisabled]}
              onPress={handleCompleteTreatment}
              disabled={completing}
              activeOpacity={0.7}
            >
              {completing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="checkmark-done-circle" size={22} color={Colors.white} />
              )}
              <Text style={styles.primaryButtonText}>
                {completing ? 'Completing...' : 'Complete Treatment'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step badge sub-component
// ---------------------------------------------------------------------------

function StepBadge({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <View style={styles.stepBadge}>
      <View
        style={[
          styles.stepCircle,
          active && styles.stepCircleActive,
          completed && styles.stepCircleCompleted,
        ]}
      >
        {completed ? (
          <Ionicons name="checkmark" size={14} color={Colors.white} />
        ) : (
          <Text
            style={[
              styles.stepNumber,
              active && styles.stepNumberActive,
            ]}
          >
            {number}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.stepLabel,
          active && styles.stepLabelActive,
          completed && styles.stepLabelCompleted,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },

  // Patient Header
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  protocolName: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    marginTop: 2,
  },
  cycleLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  stepBadge: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  stepCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  stepNumber: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  stepNumberActive: {
    color: Colors.white,
  },
  stepLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xxs,
    color: Colors.textTertiary,
  },
  stepLabelActive: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },
  stepLabelCompleted: {
    color: Colors.success,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  stepLineActive: {
    backgroundColor: Colors.success,
  },

  // Section
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  // Checklist
  checklistCard: {
    marginBottom: Spacing.lg,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  checkboxChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkLabel: {
    flex: 1,
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  checkLabelChecked: {
    color: Colors.textSecondary,
  },

  // Primary button
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },

  // Progress
  progressContainer: {
    marginBottom: Spacing.lg,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  progressCount: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: Colors.success,
    borderRadius: 4,
  },

  // Drug card
  drugCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  drugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drugSeq: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  drugSeqText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  drugInfo: {
    flex: 1,
  },
  drugName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  drugMeta: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Timer
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timerText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.info,
  },
  timerTarget: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },

  // Drug actions
  drugActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  startBtnText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  holdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.warning}15`,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  holdBtnText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.warning,
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.success,
  },
  completeBtnText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },

  // Hold / completed notes
  holdNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  holdNoteText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.warning,
    flex: 1,
    fontStyle: 'italic',
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  completedText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
  },

  // Empty
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Completion step
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.success,
  },
  summaryDrug: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  summaryDrugName: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  summaryDrugDose: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },

  // Lab entry (Feature 1)
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  labLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
  labUnit: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  labInput: {
    width: 80,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  labInputDanger: {
    borderColor: Colors.error,
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  labSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  labSubmitText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  labResultBox: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.md,
  },
  crcalcBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
  },
  crcalcText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },

  // Text input
  inputLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  textArea: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    minHeight: 100,
    marginBottom: Spacing.lg,
  },
});
