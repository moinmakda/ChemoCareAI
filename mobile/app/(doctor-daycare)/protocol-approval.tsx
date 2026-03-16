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

interface DrugDose {
  drug: string;
  dose: string;
  route: string;
  timing: string;
  day?: number;
  infusion_duration?: string;
}

interface GeneratedProtocol {
  protocol_name: string;
  regimen_code: string;
  cycle_length_days: number;
  total_cycles: number;
  drugs: DrugDose[];
  premedications: DrugDose[];
  supportive_care: string[];
  monitoring_requirements: string[];
  dose_modifications: string[];
  warnings: string[];
  ai_confidence: number;
  ai_reasoning: string;
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
      
      if (request.generated_protocol) {
        const proto = request.generated_protocol as GeneratedProtocol;
        setProtocol(proto);
        setModifiedProtocol(JSON.parse(JSON.stringify(proto))); // Deep copy
      }
      
      // Load patient
      const patientData = await patientService.getPatient(request.patient_id);
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
      
      Alert.alert(
        '✅ Protocol Approved',
        'The treatment protocol has been approved. You can now schedule treatment cycles.',
        [{ text: 'OK', onPress: () => router.back() }]
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

  const updateDrugDose = (index: number, field: keyof DrugDose, value: string) => {
    if (!modifiedProtocol) return;
    
    const newDrugs = [...modifiedProtocol.drugs];
    newDrugs[index] = { ...newDrugs[index], [field]: value };
    setModifiedProtocol({ ...modifiedProtocol, drugs: newDrugs });
    setIsModifying(true);
  };

  const updateCycles = (value: string) => {
    if (!modifiedProtocol) return;
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      setModifiedProtocol({ ...modifiedProtocol, total_cycles: num });
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
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient Info */}
        {patient && (
          <Card variant="outlined" padding="medium" style={styles.patientCard}>
            <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
            <Text style={styles.patientMeta}>
              {patient.cancerType} • {patient.cancerStage} • Age {patient.age || 'N/A'}
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
        <View style={[styles.confidenceBanner, { backgroundColor: getConfidenceColor(protocol.ai_confidence) + '15' }]}>
          <Ionicons name="sparkles" size={24} color={getConfidenceColor(protocol.ai_confidence)} />
          <View style={styles.confidenceInfo}>
            <Text style={[styles.confidenceTitle, { color: getConfidenceColor(protocol.ai_confidence) }]}>
              AI Confidence: {Math.round(protocol.ai_confidence * 100)}%
            </Text>
            <Text style={styles.confidenceReason}>{protocol.ai_reasoning}</Text>
          </View>
        </View>

        {/* Protocol Overview - Editable */}
        <Card variant="elevated" padding="large" style={styles.section}>
          <Text style={styles.sectionTitle}>Protocol Overview</Text>
          
          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Protocol Name</Text>
            <Text style={styles.protocolValue}>{modifiedProtocol.protocol_name}</Text>
          </View>
          
          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Regimen Code</Text>
            <Text style={styles.protocolValue}>{modifiedProtocol.regimen_code}</Text>
          </View>
          
          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Cycle Length</Text>
            <Text style={styles.protocolValue}>{modifiedProtocol.cycle_length_days} days</Text>
          </View>
          
          <View style={styles.editableRow}>
            <Text style={styles.protocolLabel}>Total Cycles</Text>
            <TextInput
              style={styles.editableInput}
              value={modifiedProtocol.total_cycles.toString()}
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
              <Text style={[styles.sectionTitle, { color: colors.error }]}>Warnings</Text>
            </View>
            {protocol.warnings.map((warning, index) => (
              <Text key={index} style={styles.warningText}>⚠️ {warning}</Text>
            ))}
          </Card>
        )}

        {/* Drugs - Editable */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flask" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Chemotherapy Drugs</Text>
            <Badge label="Editable" variant="info" size="small" />
          </View>
          
          {modifiedProtocol.drugs.map((drug, index) => (
            <View key={index} style={styles.drugCard}>
              <View style={styles.drugHeader}>
                <Text style={styles.drugName}>{drug.drug}</Text>
                {drug.day && <Badge label={`Day ${drug.day}`} variant="neutral" size="small" />}
              </View>
              
              <View style={styles.drugEditRow}>
                <Text style={styles.drugLabel}>Dose:</Text>
                <TextInput
                  style={styles.drugInput}
                  value={drug.dose}
                  onChangeText={(v) => updateDrugDose(index, 'dose', v)}
                />
              </View>
              
              <View style={styles.drugEditRow}>
                <Text style={styles.drugLabel}>Route:</Text>
                <TextInput
                  style={styles.drugInput}
                  value={drug.route}
                  onChangeText={(v) => updateDrugDose(index, 'route', v)}
                />
              </View>
              
              <View style={styles.drugEditRow}>
                <Text style={styles.drugLabel}>Timing:</Text>
                <TextInput
                  style={styles.drugInput}
                  value={drug.timing}
                  onChangeText={(v) => updateDrugDose(index, 'timing', v)}
                />
              </View>
              
              {drug.infusion_duration && (
                <View style={styles.drugEditRow}>
                  <Text style={styles.drugLabel}>Infusion:</Text>
                  <TextInput
                    style={styles.drugInput}
                    value={drug.infusion_duration}
                    onChangeText={(v) => updateDrugDose(index, 'infusion_duration', v)}
                  />
                </View>
              )}
            </View>
          ))}
        </Card>

        {/* Premedications */}
        {modifiedProtocol.premedications && modifiedProtocol.premedications.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical" size={24} color={colors.success} />
              <Text style={styles.sectionTitle}>Premedications</Text>
            </View>
            
            {modifiedProtocol.premedications.map((drug, index) => (
              <View key={index} style={styles.premedItem}>
                <Text style={styles.premedName}>{drug.drug}</Text>
                <Text style={styles.premedDetails}>
                  {drug.dose} • {drug.route} • {drug.timing}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Patient Clinical Data / Labs */}
        {protocolRequest?.clinical_data && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flask" size={24} color={colors.info} />
              <Text style={styles.sectionTitle}>Clinical Data</Text>
            </View>

            {/* Biometrics */}
            {(protocolRequest.clinical_data.height_cm || protocolRequest.clinical_data.weight_kg || protocolRequest.clinical_data.bsa) && (
              <View style={styles.labGrid}>
                {protocolRequest.clinical_data.height_cm && (
                  <View style={styles.labItem}>
                    <Text style={styles.labValue}>{protocolRequest.clinical_data.height_cm} cm</Text>
                    <Text style={styles.labLabel}>Height</Text>
                  </View>
                )}
                {protocolRequest.clinical_data.weight_kg && (
                  <View style={styles.labItem}>
                    <Text style={styles.labValue}>{protocolRequest.clinical_data.weight_kg} kg</Text>
                    <Text style={styles.labLabel}>Weight</Text>
                  </View>
                )}
                {protocolRequest.clinical_data.bsa && (
                  <View style={styles.labItem}>
                    <Text style={styles.labValue}>{protocolRequest.clinical_data.bsa} m²</Text>
                    <Text style={styles.labLabel}>BSA</Text>
                  </View>
                )}
              </View>
            )}

            {/* Latest Labs */}
            {protocolRequest.clinical_data.latest_labs && (
              <>
                <Text style={styles.labSectionTitle}>Latest Labs</Text>
                <View style={styles.labGrid}>
                  {protocolRequest.clinical_data.latest_labs.full_blood_count?.wbc !== undefined && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{protocolRequest.clinical_data.latest_labs.full_blood_count.wbc}</Text>
                      <Text style={styles.labLabel}>WBC</Text>
                    </View>
                  )}
                  {protocolRequest.clinical_data.latest_labs.full_blood_count?.hb !== undefined && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{protocolRequest.clinical_data.latest_labs.full_blood_count.hb}</Text>
                      <Text style={styles.labLabel}>Hb</Text>
                    </View>
                  )}
                  {protocolRequest.clinical_data.latest_labs.full_blood_count?.platelets !== undefined && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{protocolRequest.clinical_data.latest_labs.full_blood_count.platelets}</Text>
                      <Text style={styles.labLabel}>Platelets</Text>
                    </View>
                  )}
                  {protocolRequest.clinical_data.latest_labs.creatinine !== undefined && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{protocolRequest.clinical_data.latest_labs.creatinine}</Text>
                      <Text style={styles.labLabel}>Creatinine</Text>
                    </View>
                  )}
                  {protocolRequest.clinical_data.latest_labs.gfr !== undefined && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{protocolRequest.clinical_data.latest_labs.gfr}</Text>
                      <Text style={styles.labLabel}>GFR</Text>
                    </View>
                  )}
                  {protocolRequest.clinical_data.latest_labs.bilirubin !== undefined && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{protocolRequest.clinical_data.latest_labs.bilirubin}</Text>
                      <Text style={styles.labLabel}>Bilirubin</Text>
                    </View>
                  )}
                  {protocolRequest.clinical_data.latest_labs.liver_function?.alt !== undefined && (
                    <View style={styles.labItem}>
                      <Text style={styles.labValue}>{protocolRequest.clinical_data.latest_labs.liver_function.alt}</Text>
                      <Text style={styles.labLabel}>ALT</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Allergies / Comorbidities */}
            {protocolRequest.clinical_data.medical_history?.allergies && protocolRequest.clinical_data.medical_history.allergies.length > 0 && (
              <View style={styles.warningRow}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.allergyText}>
                  Allergies: {protocolRequest.clinical_data.medical_history.allergies.join(', ')}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Nurse Review Notes */}
        {protocolRequest?.nurse_review_notes && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubble-ellipses" size={24} color={colors.info} />
              <Text style={styles.sectionTitle}>Nurse Notes</Text>
            </View>
            <Text style={styles.nurseNotes}>{protocolRequest.nurse_review_notes}</Text>
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
  warningText: {
    fontSize: typography.body.fontSize,
    color: colors.error,
    marginBottom: spacing.sm,
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
