/**
 * Nurse Protocol Review Screen
 * Review AI-generated protocol and approve/reject before doctor review
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/constants/theme';
import { Card, Header, Button, Input, Badge, Modal } from '../../src/components';
import {
  getProtocolRequest,
  nurseApproveProtocol,
  ProtocolRequest,
} from '../../src/services/protocolService';

// SOPHIA Protocol Response types (camelCase — api.ts interceptor converts all keys)
interface SophiaCalculatedDose {
  drugName: string;
  calculatedDose: number;
  calculatedDoseUnit: string;
  originalDose: number;
  originalDoseUnit: string;
  route: string;
  days: number[];
  durationMinutes?: number;
  doseModified: boolean;
  modificationReason?: string;
  modificationPercent?: number;
  specialInstructions?: string;
  diluent?: string;
  diluentVolumeMl?: number;
}

interface SophiaWarning {
  level: 'info' | 'warning' | 'critical';
  message: string;
  drugId?: string;
}

interface GeneratedProtocol {
  protocolName: string;
  protocolCode: string;
  cycleLengthDays: number;
  totalCycles: number;
  cycleNumber: number;
  patientBsa: number;
  patientBsaCapped: boolean;
  patientWeight: number;
  patientAge?: number;
  chemotherapyDrugs: SophiaCalculatedDose[];
  preMedications: SophiaCalculatedDose[];
  takeHomeMedicines: SophiaCalculatedDose[];
  rescueMedications: SophiaCalculatedDose[];
  warnings: SophiaWarning[];
  doseModificationsApplied: string[];
  monitoringRequirements: string[];
  specialInstructions: string[];
  treatmentDelayRecommended: boolean;
  treatmentAbsolutelyContraindicated: boolean;
  delayReasons: string[];
  disclaimer: string;
}

export default function NurseProtocolReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId: string }>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [protocolRequest, setProtocolRequest] = useState<ProtocolRequest | null>(null);
  const [protocol, setProtocol] = useState<GeneratedProtocol | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadProtocolRequest();
  }, [params.requestId]);

  const loadProtocolRequest = async () => {
    if (!params.requestId) {
      Alert.alert('Error', 'No request ID provided');
      router.back();
      return;
    }
    
    try {
      const request = await getProtocolRequest(params.requestId);
      setProtocolRequest(request);
      
      const gp = (request as any).generatedProtocol || (request as any).generated_protocol;
      if (gp) {
        setProtocol(gp as GeneratedProtocol);
      }
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
      'This will send the protocol to the doctor for final approval. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: submitApproval },
      ]
    );
  };

  const submitApproval = async () => {
    setIsSubmitting(true);
    
    try {
      await nurseApproveProtocol(protocolRequest!.id, 'approve', reviewNotes);
      
      Alert.alert(
        '✅ Protocol Approved',
        'The protocol has been sent to the doctor for final approval.',
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
      await nurseApproveProtocol(protocolRequest!.id, 'reject', rejectReason);
      setShowRejectModal(false);
      
      Alert.alert(
        'Protocol Rejected',
        'The protocol request has been rejected.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to reject protocol');
    } finally {
      setIsSubmitting(false);
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
        <Header title="Protocol Review" showBackButton onBackPress={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading protocol...</Text>
        </View>
      </View>
    );
  }

  if (!protocol) {
    return (
      <View style={styles.container}>
        <Header title="Protocol Review" showBackButton onBackPress={() => router.back()} />
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No Protocol Generated</Text>
          <Text style={styles.emptyText}>
            The AI has not generated a protocol yet. Please ensure clinical data is complete.
          </Text>
          <Button
            title="Go Back"
            variant="primary"
            onPress={() => router.back()}
            style={styles.emptyButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Protocol Review" 
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
        {/* Treatment Delay / Contraindication Alert */}
        {protocol.treatmentAbsolutelyContraindicated && (
          <View style={[styles.confidenceBanner, { backgroundColor: colors.error + '20' }]}>
            <Ionicons name="close-circle" size={24} color={colors.error} />
            <View style={styles.confidenceInfo}>
              <Text style={[styles.confidenceTitle, { color: colors.error }]}>
                TREATMENT CONTRAINDICATED
              </Text>
              <Text style={styles.confidenceReason}>
                {protocol.delayReasons?.join('. ') || 'Critical safety thresholds exceeded. All chemotherapy withheld.'}
              </Text>
            </View>
          </View>
        )}

        {protocol.treatmentDelayRecommended && !protocol.treatmentAbsolutelyContraindicated && (
          <View style={[styles.confidenceBanner, { backgroundColor: colors.warning + '20' }]}>
            <Ionicons name="time" size={24} color={colors.warning} />
            <View style={styles.confidenceInfo}>
              <Text style={[styles.confidenceTitle, { color: colors.warning }]}>
                Treatment Delay Recommended
              </Text>
              <Text style={styles.confidenceReason}>
                {protocol.delayReasons?.join('. ') || 'Lab values suggest delaying treatment.'}
              </Text>
            </View>
          </View>
        )}

        {/* Protocol Header */}
        <Card variant="elevated" padding="large" style={styles.protocolCard}>
          <View style={styles.protocolHeader}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={styles.protocolName} numberOfLines={2}>{protocol.protocolName}</Text>
              <Text style={styles.regimenCode}>{protocol.protocolCode}</Text>
            </View>
            <Badge label={protocolRequest?.status?.replace('_', ' ') || ''} variant="info" />
          </View>

          <View style={styles.protocolMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.metaText}>{protocol.cycleLengthDays}-day cycles</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="repeat-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.metaText}>{protocol.totalCycles} total cycles</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="body-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.metaText}>
                BSA: {protocol.patientBsa != null ? Number(protocol.patientBsa).toFixed(2) : '--'} m²{protocol.patientBsaCapped ? ' (capped)' : ''}
              </Text>
            </View>
          </View>
        </Card>

        {/* Warnings — tiered by severity */}
        {protocol.warnings && protocol.warnings.length > 0 && (
          <Card variant="outlined" padding="medium" style={[styles.section, styles.warningsCard]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={24} color={colors.error} />
              <Text style={[styles.sectionTitle, { color: colors.error }]}>
                Safety Alerts ({protocol.warnings.length})
              </Text>
            </View>
            {protocol.warnings.map((warning, index) => {
              const warnObj = typeof warning === 'string'
                ? { level: 'warning' as const, message: warning }
                : warning;
              const iconColor = warnObj.level === 'critical' ? colors.error : warnObj.level === 'warning' ? colors.warning : colors.info;
              return (
                <View key={index} style={[styles.warningItem, {
                  borderLeftColor: iconColor,
                  backgroundColor: iconColor + '10',
                }]}>
                  <Text style={[styles.warningBadge, { color: iconColor }]}>
                    {warnObj.level?.toUpperCase()}
                  </Text>
                  <Text style={styles.warningText}>{warnObj.message}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Chemotherapy Drugs */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flask" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>
              Chemotherapy Drugs ({protocol.chemotherapyDrugs?.length || 0})
            </Text>
          </View>

          {(protocol.chemotherapyDrugs || []).map((drug, index) => (
            <View key={index} style={[styles.drugItem, drug.doseModified && { borderLeftColor: colors.warning }]}>
              <View style={styles.drugHeader}>
                <Text style={styles.drugName} numberOfLines={2}>{drug.drugName}</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {drug.days?.map((d) => (
                    <Badge key={d} label={`D${d}`} variant="neutral" size="small" />
                  ))}
                </View>
              </View>
              <View style={styles.drugDetails}>
                <Text style={styles.drugDose}>
                  {drug.calculatedDose === 0 && drug.calculatedDoseUnit?.toLowerCase() === 'per label'
                    ? 'Per label'
                    : `${drug.calculatedDose != null ? Number(drug.calculatedDose).toFixed(1) : '--'} ${drug.calculatedDoseUnit || ''}`}
                </Text>
                <Text style={styles.drugRoute}>
                  {drug.route}
                  {drug.durationMinutes ? ` over ${drug.durationMinutes} min` : ''}
                  {drug.diluent ? ` in ${drug.diluentVolumeMl != null ? `${drug.diluentVolumeMl}ml ` : ''}${drug.diluent}` : ''}
                </Text>
                {drug.doseModified && drug.modificationReason && (
                  <Text style={styles.drugModified}>{drug.modificationReason}</Text>
                )}
                {drug.specialInstructions && (
                  <Text style={styles.drugInfusion}>{drug.specialInstructions}</Text>
                )}
              </View>
            </View>
          ))}
        </Card>

        {/* Premedications */}
        {protocol.preMedications && protocol.preMedications.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical" size={24} color={colors.success} />
              <Text style={styles.sectionTitle}>Pre-medications ({protocol.preMedications.length})</Text>
            </View>

            {protocol.preMedications.map((drug, index) => (
              <View key={index} style={styles.premedItem}>
                <Text style={styles.premedName} numberOfLines={2}>{drug.drugName}</Text>
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

        {/* Take-home Medicines */}
        {protocol.takeHomeMedicines && protocol.takeHomeMedicines.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="home" size={24} color={colors.info} />
              <Text style={styles.sectionTitle}>Take-home Medicines ({protocol.takeHomeMedicines.length})</Text>
            </View>

            {protocol.takeHomeMedicines.map((drug, index) => (
              <View key={index} style={styles.premedItem}>
                <Text style={styles.premedName} numberOfLines={2}>{drug.drugName}</Text>
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

        {/* Monitoring Requirements */}
        {protocol.monitoringRequirements && protocol.monitoringRequirements.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="eye" size={24} color={colors.warning} />
              <Text style={styles.sectionTitle}>Monitoring</Text>
            </View>

            {protocol.monitoringRequirements.map((item, index) => (
              <Text key={index} style={styles.monitoringItem}>{item}</Text>
            ))}
          </Card>
        )}

        {/* Dose Modifications Applied */}
        {protocol.doseModificationsApplied && protocol.doseModificationsApplied.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="options" size={24} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Dose Modifications</Text>
            </View>
            
            {protocol.doseModificationsApplied.map((item, index) => (
              <Text key={index} style={styles.modificationItem}>{item}</Text>
            ))}
          </Card>
        )}

        {/* Nurse Review Notes */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Review Notes</Text>
          </View>
          
          <Input
            placeholder="Add any notes for the reviewing doctor..."
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
            title="Approve & Send to Doctor"
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
          Please provide a reason for rejecting this protocol:
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
  emptyButton: {
    marginTop: spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
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
    flexShrink: 1,
  },
  protocolCard: {
    marginBottom: spacing.lg,
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  protocolName: {
    fontSize: typography.title3.fontSize,
    fontWeight: typography.title3.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  regimenCode: {
    fontSize: typography.body.fontSize,
    color: colors.primary[500],
    marginTop: spacing.xs,
  },
  protocolMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    rowGap: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  warningsCard: {
    borderColor: colors.error,
    backgroundColor: colors.error + '08',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  warningItem: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
  },
  warningBadge: {
    fontSize: typography.caption2.fontSize,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    flexShrink: 1,
  },
  drugModified: {
    fontSize: typography.caption1.fontSize,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 4,
  },
  drugItem: {
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  drugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  drugName: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  drugDetails: {
    marginTop: spacing.xs,
  },
  drugDose: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.primary[600],
  },
  drugRoute: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  drugInfusion: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
    fontStyle: 'italic',
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
  supportiveItem: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  monitoringItem: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  modificationItem: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
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
