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
      
      if (request.generated_protocol) {
        setProtocol(request.generated_protocol as GeneratedProtocol);
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
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Confidence Banner */}
        <View style={[styles.confidenceBanner, { backgroundColor: getConfidenceColor(protocol.ai_confidence) + '15' }]}>
          <Ionicons name="sparkles" size={24} color={getConfidenceColor(protocol.ai_confidence)} />
          <View style={styles.confidenceInfo}>
            <Text style={[styles.confidenceTitle, { color: getConfidenceColor(protocol.ai_confidence) }]}>
              AI Confidence: {Math.round(protocol.ai_confidence * 100)}%
            </Text>
            <Text style={styles.confidenceReason}>{protocol.ai_reasoning}</Text>
          </View>
        </View>

        {/* Protocol Header */}
        <Card variant="elevated" padding="large" style={styles.protocolCard}>
          <View style={styles.protocolHeader}>
            <View>
              <Text style={styles.protocolName}>{protocol.protocol_name}</Text>
              <Text style={styles.regimenCode}>{protocol.regimen_code}</Text>
            </View>
            <Badge label={protocolRequest?.status?.replace('_', ' ') || ''} variant="info" />
          </View>
          
          <View style={styles.protocolMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.metaText}>{protocol.cycle_length_days}-day cycles</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="repeat-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.metaText}>{protocol.total_cycles} total cycles</Text>
            </View>
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
              <View key={index} style={styles.warningItem}>
                <Text style={styles.warningText}>⚠️ {warning}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Chemotherapy Drugs */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flask" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Chemotherapy Drugs</Text>
          </View>
          
          {protocol.drugs.map((drug, index) => (
            <View key={index} style={styles.drugItem}>
              <View style={styles.drugHeader}>
                <Text style={styles.drugName}>{drug.drug}</Text>
                {drug.day && <Badge label={`Day ${drug.day}`} variant="neutral" size="small" />}
              </View>
              <View style={styles.drugDetails}>
                <Text style={styles.drugDose}>{drug.dose}</Text>
                <Text style={styles.drugRoute}>{drug.route} • {drug.timing}</Text>
                {drug.infusion_duration && (
                  <Text style={styles.drugInfusion}>Infusion: {drug.infusion_duration}</Text>
                )}
              </View>
            </View>
          ))}
        </Card>

        {/* Premedications */}
        {protocol.premedications && protocol.premedications.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical" size={24} color={colors.success} />
              <Text style={styles.sectionTitle}>Premedications</Text>
            </View>
            
            {protocol.premedications.map((drug, index) => (
              <View key={index} style={styles.premedItem}>
                <Text style={styles.premedName}>{drug.drug}</Text>
                <Text style={styles.premedDetails}>
                  {drug.dose} • {drug.route} • {drug.timing}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Supportive Care */}
        {protocol.supportive_care && protocol.supportive_care.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={24} color={colors.info} />
              <Text style={styles.sectionTitle}>Supportive Care</Text>
            </View>
            
            {protocol.supportive_care.map((item, index) => (
              <Text key={index} style={styles.supportiveItem}>• {item}</Text>
            ))}
          </Card>
        )}

        {/* Monitoring Requirements */}
        {protocol.monitoring_requirements && protocol.monitoring_requirements.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="eye" size={24} color={colors.warning} />
              <Text style={styles.sectionTitle}>Monitoring</Text>
            </View>
            
            {protocol.monitoring_requirements.map((item, index) => (
              <Text key={index} style={styles.monitoringItem}>• {item}</Text>
            ))}
          </Card>
        )}

        {/* Dose Modifications */}
        {protocol.dose_modifications && protocol.dose_modifications.length > 0 && (
          <Card variant="outlined" padding="medium" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="options" size={24} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Dose Modifications</Text>
            </View>
            
            {protocol.dose_modifications.map((item, index) => (
              <Text key={index} style={styles.modificationItem}>• {item}</Text>
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
    gap: spacing.lg,
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
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  warningText: {
    fontSize: typography.body.fontSize,
    color: colors.error,
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
  },
  modificationItem: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
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
