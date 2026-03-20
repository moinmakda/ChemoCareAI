/**
 * Doctor Protocol Approval Screen
 * Final approval, modification, or rejection of AI-generated protocols
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextStyle,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/constants/theme';
import { Card, Header, Button, Input, Badge, Modal } from '../../src/components';
import {
  getProtocolRequest,
  doctorApproveProtocol,
  ProtocolRequest,
} from '../../src/services/protocolService';
import { patientService } from '../../src/services';

// SOPHIA protocol response (camelCase — api.ts interceptor converts)
interface GeneratedProtocol {
  protocolName: string;
  protocolCode: string;
  cycleLengthDays: number;
  totalCycles: number;
  cycleNumber: number;
  patientBsa: number;
  patientBsaCapped: boolean;
  chemotherapyDrugs: any[];
  preMedications: any[];
  takeHomeMedicines: any[];
  rescueMedications: any[];
  warnings: { level: string; message: string }[];
  doseModificationsApplied: string[];
  monitoringRequirements: string[];
  specialInstructions: string[];
  treatmentDelayRecommended: boolean;
  treatmentAbsolutelyContraindicated: boolean;
  delayReasons: string[];
  [key: string]: any;
}

export default function DoctorProtocolApprovalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [protocolRequest, setProtocolRequest] = useState<ProtocolRequest | null>(null);
  const [protocol, setProtocol] = useState<GeneratedProtocol | null>(null);
  const [patient, setPatient] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modification mode
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedProtocol, setModifiedProtocol] = useState<GeneratedProtocol | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadData();
  }, [params.requestId]);

  const loadData = async () => {
    if (!params.requestId) {
      Alert.alert('Error', 'No request ID provided');
      router.back();
      return;
    }

    try {
      const request = await getProtocolRequest(params.requestId);
      setProtocolRequest(request);

      const gp = (request as any).generatedProtocol;
      if (gp) {
        setProtocol(gp as GeneratedProtocol);
        setModifiedProtocol(JSON.parse(JSON.stringify(gp))); // Deep copy
      }

      // Load patient
      const patientData = await patientService.getPatient((request as any).patientId);
      setPatient(patientData);
    } catch {
      Alert.alert('Error', 'Failed to load protocol request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!protocolRequest) return;

    Alert.alert(
      'Approve Protocol',
      'This will finalize the protocol and allow scheduling. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: submitApproval },
      ]
    );
  };

  const submitApproval = async () => {
    setIsSubmitting(true);

    try {
      const protocolToSubmit = isModifying ? modifiedProtocol : undefined;

      await doctorApproveProtocol(
        protocolRequest!.id,
        isModifying ? 'modify' : 'approve',
        reviewNotes,
        protocolToSubmit as Record<string, any>
      );

      const protocolName = protocol?.protocolName || 'the protocol';
      const protocolsRoute = '/(doctor-opd)/protocols';
      Alert.alert(
        'Protocol Approved',
        `Treatment plan updated for ${protocolName}. The cycle is now approved and ready for treatment.`,
        [
          { text: 'View Treatment Plans', onPress: () => router.replace(protocolsRoute as any) },
          { text: 'Done', onPress: () => router.back(), style: 'cancel' },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to approve protocol');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for rejection');
      return;
    }

    setIsSubmitting(true);

    try {
      await doctorApproveProtocol(protocolRequest!.id, 'reject', rejectReason);
      setShowRejectModal(false);

      Alert.alert(
        'Protocol Rejected',
        'The protocol has been rejected and sent back for revision.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to reject protocol');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateDrugDose = (index: number, field: string, value: string) => {
    if (!modifiedProtocol) return;

    const drugs = [...(modifiedProtocol.chemotherapyDrugs || [])];
    drugs[index] = { ...drugs[index], [field]: value };
    setModifiedProtocol({ ...modifiedProtocol, chemotherapyDrugs: drugs });
    setIsModifying(true);
  };

  const updateCycles = (value: string) => {
    if (!modifiedProtocol) return;
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      setModifiedProtocol({ ...modifiedProtocol, totalCycles: num });
      setIsModifying(true);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return colors.success;
    if (confidence >= 0.7) return colors.warning;
    return colors.error;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Protocol Approval" showBackButton onBackPress={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading protocol...</Text>
        </View>
      </View>
    );
  }

  if (!protocol || !modifiedProtocol) {
    return (
      <View style={styles.container}>
        <Header title="Protocol Approval" showBackButton onBackPress={() => router.back()} />
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No Protocol Found</Text>
          <Text style={styles.emptyText}>
            The protocol could not be loaded or has not been generated yet.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Protocol Approval"
        showBackButton
        onBackPress={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Patient Info */}
        {patient && (
          <Card variant="outlined" padding="medium" style={styles.patientCard}>
            <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
            <Text style={styles.patientMeta} numberOfLines={2}>
              {patient.cancerType || 'Type TBD'} • {patient.cancerStage || 'Stage TBD'} • Age {patient.age || 'N/A'}
            </Text>
          </Card>
        )}

        {/* Modification Banner */}
        {isModifying && (
          <View style={styles.modifyingBanner}>
            <Ionicons name="pencil" size={20} color={colors.warning} />
            <Text style={styles.modifyingText}>You have modified this protocol</Text>
            <TouchableOpacity onPress={() => {
              setModifiedProtocol(JSON.parse(JSON.stringify(protocol)));
              setIsModifying(false);
            }}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI Confidence */}
        <View style={[styles.confidenceBanner, { backgroundColor: getConfidenceColor((protocol as any).aiConfidence) + '15' }]}>
          <Ionicons name="sparkles" size={24} color={getConfidenceColor((protocol as any).aiConfidence)} />
          <View style={styles.confidenceInfo}>
            <Text style={[styles.confidenceTitle, { color: getConfidenceColor((protocol as any).aiConfidence) }]}>
              AI Confidence: {Math.round(((protocol as any).aiConfidence || 0) * 100)}%
            </Text>
            <Text style={styles.confidenceReason}>{(protocol as any).aiReasoning}</Text>
          </View>
        </View>

        {/* Protocol Overview - Editable */}
        <Card variant="elevated" padding="large" style={styles.section}>
          <Text style={styles.sectionTitle}>Protocol Overview</Text>

          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Protocol Name</Text>
            <Text style={styles.protocolValue} numberOfLines={2}>{modifiedProtocol.protocolName}</Text>
          </View>

          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Regimen Code</Text>
            <Text style={styles.protocolValue}>{(modifiedProtocol as any).regimenCode || modifiedProtocol.protocolCode}</Text>
          </View>

          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Cycle Length</Text>
            <Text style={styles.protocolValue}>{modifiedProtocol.cycleLengthDays} days</Text>
          </View>

          <View style={styles.editableRow}>
            <Text style={styles.protocolLabel}>Total Cycles</Text>
            <TextInput
              style={styles.editableInput}
              value={modifiedProtocol.totalCycles.toString()}
              onChangeText={updateCycles}
              keyboardType="number-pad"
            />
          </View>
        </Card>

        {/* Warnings */}
        {protocol.warnings && protocol.warnings.length > 0 && (
          <Card variant="outlined" padding="medium" style={[styles.section, styles.warningsCard]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={24} color={colors.error} />
              <Text style={[styles.sectionTitle, { color: colors.error }]}>
                Safety Alerts ({protocol.warnings.length})
              </Text>
            </View>
            {protocol.warnings.map((warning: any, index: number) => {
              const w = typeof warning === 'string' ? { level: 'warning', message: warning } : warning;
              const color = w.level === 'critical' ? colors.error : w.level === 'warning' ? colors.warning : colors.info;
              return (
                <View key={index} style={[styles.warningItem, { borderLeftColor: color, backgroundColor: color + '10' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color, marginBottom: 2 }}>{w.level?.toUpperCase()}</Text>
                  <Text style={styles.warningText}>{w.message}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Drugs - Editable */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flask" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Chemotherapy Drugs</Text>
            <Badge label="Editable" variant="info" size="small" />
          </View>

          {(modifiedProtocol.chemotherapyDrugs || []).map((drug: any, index: number) => (
            <View key={index} style={[styles.drugCard, drug.doseModified && { borderLeftWidth: 3, borderLeftColor: colors.warning }]}>
              <View style={styles.drugHeader}>
                <Text style={styles.drugName} numberOfLines={2}>{drug.drugName}</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {drug.days?.map((d: number) => (
                    <Badge key={d} label={`D${d}`} variant="neutral" size="small" />
                  ))}
                </View>
              </View>

              <View style={styles.drugEditRow}>
                <Text style={styles.drugLabel}>Dose:</Text>
                <TextInput
                  style={styles.drugInput}
                  value={String(drug.calculatedDose ?? '')}
                  onChangeText={(v) => updateDrugDose(index, 'calculatedDose', v)}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.drugUnit}>{drug.calculatedDoseUnit || ''}</Text>
              </View>

              <View style={styles.drugEditRow}>
                <Text style={styles.drugLabel}>Route:</Text>
                <Text style={styles.drugValue}>{drug.route}</Text>
              </View>

              {drug.durationMinutes && (
                <View style={styles.drugEditRow}>
                  <Text style={styles.drugLabel}>Duration:</Text>
                  <Text style={styles.drugValue}>{drug.durationMinutes} min</Text>
                </View>
              )}

              {drug.diluent && (
                <View style={styles.drugEditRow}>
                  <Text style={styles.drugLabel}>Diluent:</Text>
                  <Text style={styles.drugValue}>{drug.diluentVolumeMl != null ? `${drug.diluentVolumeMl}ml ` : ''}{drug.diluent}</Text>
                </View>
              )}

              {drug.doseModified && drug.modificationReason && (
                <Text style={{ fontSize: 13, color: colors.warning, fontWeight: '600', marginTop: 4 }}>
                  {drug.modificationReason}
                </Text>
              )}
            </View>
          ))}
        </Card>

        {/* Premedications */}
        {modifiedProtocol.preMedications && modifiedProtocol.preMedications.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical" size={24} color={colors.success} />
              <Text style={styles.sectionTitle}>Pre-medications ({modifiedProtocol.preMedications.length})</Text>
            </View>

            {modifiedProtocol.preMedications.map((drug: any, index: number) => (
              <View key={index} style={styles.premedItem}>
                <Text style={styles.premedName}>{drug.drugName}</Text>
                <Text style={styles.premedDetails}>
                  {drug.calculatedDose === 0 && drug.calculatedDoseUnit?.toLowerCase() === 'per label'
                    ? 'Per label'
                    : `${drug.calculatedDose != null ? Number(drug.calculatedDose).toFixed(1) : '--'} ${drug.calculatedDoseUnit || ''}`} {drug.route}
                  {drug.specialInstructions ? ` - ${drug.specialInstructions}` : ''}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Patient Clinical Data / Labs */}
        {(() => {
          const cd: any = (protocolRequest as any)?.clinicalData;
          if (!cd) return null;
          const labs = cd.latestLabs;
          const fbc = labs?.fullBloodCount;
          const lft = labs?.liverFunction;
          const hist = cd.medicalHistory;
          const allergies = cd.knownAllergies || hist?.allergies || [];
          return (
            <Card variant="outlined" padding="medium" style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="flask" size={24} color={colors.info} />
                <Text style={styles.sectionTitle}>Clinical Data</Text>
              </View>

              {(cd.heightCm || cd.weightKg || cd.bsa) && (
                <View style={styles.labGrid}>
                  {cd.heightCm && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{cd.heightCm} cm</Text>
                      <Text style={styles.labLabel}>Height</Text>
                    </View>
                  )}
                  {cd.weightKg && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{cd.weightKg} kg</Text>
                      <Text style={styles.labLabel}>Weight</Text>
                    </View>
                  )}
                  {cd.bsa && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{cd.bsa} m²</Text>
                      <Text style={styles.labLabel}>BSA</Text>
                    </View>
                  )}
                </View>
              )}

              {/* SOPHIA direct labs */}
              {(cd.neutrophils || cd.platelets || cd.hemoglobin || cd.bilirubin || cd.gfr) && (
                <>
                  <Text style={styles.labSectionTitle}>Labs</Text>
                  <View style={styles.labGrid}>
                    {cd.neutrophils !== undefined && (
                      <View style={styles.labItem}>
                        <Text style={styles.labValue}>{cd.neutrophils}</Text>
                        <Text style={styles.labLabel}>Neutrophils</Text>
                      </View>
                    )}
                    {cd.platelets !== undefined && (
                      <View style={styles.labItem}>
                        <Text style={styles.labValue}>{cd.platelets}</Text>
                        <Text style={styles.labLabel}>Platelets</Text>
                      </View>
                    )}
                    {cd.hemoglobin !== undefined && (
                      <View style={styles.labItem}>
                        <Text style={styles.labValue}>{cd.hemoglobin}</Text>
                        <Text style={styles.labLabel}>Hb</Text>
                      </View>
                    )}
                    {cd.bilirubin !== undefined && (
                      <View style={styles.labItem}>
                        <Text style={styles.labValue}>{cd.bilirubin}</Text>
                        <Text style={styles.labLabel}>Bilirubin</Text>
                      </View>
                    )}
                    {cd.gfr !== undefined && (
                      <View style={styles.labItem}>
                        <Text style={styles.labValue}>{cd.gfr}</Text>
                        <Text style={styles.labLabel}>GFR</Text>
                      </View>
                    )}
                    {cd.creatinine !== undefined && (
                      <View style={styles.labItem}>
                        <Text style={styles.labValue}>{cd.creatinine}</Text>
                        <Text style={styles.labLabel}>Creatinine</Text>
                      </View>
                    )}
                    {cd.ast !== undefined && (
                      <View style={styles.labItem}>
                        <Text style={styles.labValue}>{cd.ast}</Text>
                        <Text style={styles.labLabel}>AST</Text>
                      </View>
                    )}
                    {cd.alt !== undefined && (
                      <View style={styles.labItem}>
                        <Text style={styles.labValue}>{cd.alt}</Text>
                        <Text style={styles.labLabel}>ALT</Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              {allergies.length > 0 && (
                <View style={styles.warningRow}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.allergyText}>
                    Allergies: {allergies.join(', ')}
                  </Text>
                </View>
              )}
            </Card>
          );
        })()}

        {/* Nurse Review Notes */}
        {(protocolRequest as any)?.nurseReviewNotes && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubble-ellipses" size={24} color={colors.info} />
              <Text style={styles.sectionTitle}>Nurse Notes</Text>
            </View>
            <Text style={styles.nurseNotes}>{(protocolRequest as any).nurseReviewNotes}</Text>
          </Card>
        )}

        {/* Doctor Notes */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Doctor Notes</Text>
          </View>

          <Input
            placeholder="Add notes about your decision..."
            value={reviewNotes}
            onChangeText={setReviewNotes}
            multiline
            numberOfLines={4}
          />
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Reject"
            variant="outline"
            onPress={() => setShowRejectModal(true)}
            style={styles.rejectButton}
            icon={<Ionicons name="close-circle" size={20} color={colors.error} style={{ marginRight: 8 }} />}
          />
          <Button
            title={isModifying ? "Approve with Changes" : "Approve Protocol"}
            variant="primary"
            onPress={handleApprove}
            loading={isSubmitting}
            style={styles.approveButton}
            icon={<Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Protocol"
      >
        <Text style={styles.rejectModalText}>
          Please provide a reason for rejection. This will be sent back to the nurse for revision.
        </Text>
        <Input
          placeholder="Reason for rejection..."
          value={rejectReason}
          onChangeText={setRejectReason}
          multiline
          numberOfLines={4}
        />
        <View style={styles.rejectModalButtons}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setShowRejectModal(false)}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          <Button
            title="Confirm Reject"
            variant="primary"
            onPress={handleReject}
            loading={isSubmitting}
            style={{ flex: 1, marginLeft: spacing.sm, backgroundColor: colors.error }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.title3.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  patientCard: {
    marginBottom: spacing.md,
  },
  patientName: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
  },
  patientMeta: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  modifyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.warning + '15',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  modifyingText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.warning,
  },
  resetText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.primary[500],
  },
  confidenceBanner: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  confidenceInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  confidenceTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
  },
  confidenceReason: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
  },
  warningsCard: {
    borderColor: colors.error,
    backgroundColor: colors.error + '08',
  },
  warningItem: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
  },
  warningText: {
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    flexShrink: 1,
  },
  protocolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  protocolLabel: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  },
  protocolValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'right' as const,
  },
  editableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  editableInput: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.primary[600],
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    minWidth: 80,
    textAlign: 'center',
  },
  drugCard: {
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  drugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  drugName: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  drugEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  drugLabel: {
    width: 70,
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
  },
  drugInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  drugUnit: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    minWidth: 30,
  },
  drugValue: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
  },
  premedItem: {
    padding: spacing.sm,
    backgroundColor: colors.success + '10',
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  premedName: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
  },
  premedDetails: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  nurseNotes: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  labSectionTitle: {
    fontSize: typography.caption1.fontSize,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  labItem: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 70,
  },
  labValue: {
    fontSize: typography.headline.fontSize,
    fontWeight: '700',
    color: colors.text.primary,
  },
  labLabel: {
    fontSize: typography.caption2.fontSize,
    color: colors.text.secondary,
    marginTop: 2,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.md,
  },
  allergyText: {
    flex: 1,
    fontSize: typography.caption1.fontSize,
    color: colors.error,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  rejectButton: {
    flex: 1,
    borderColor: colors.error,
  },
  approveButton: {
    flex: 2,
  },
  rejectModalText: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  rejectModalButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
});
