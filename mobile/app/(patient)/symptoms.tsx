/**
 * Patient Symptom Diary Screen
 * Patients track their symptoms and get AI severity assessment
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextStyle,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/constants/theme';
import { Card, Header, Button, Modal, Input } from '../../src/components';
import { symptomsService, SymptomCreate } from '../../src/services/symptomsService';
import type { SymptomEntry } from '../../src/types';

const SYMPTOM_OPTIONS = [
  { id: 'nausea', label: 'Nausea', icon: 'medical' },
  { id: 'fatigue', label: 'Fatigue', icon: 'battery-dead' },
  { id: 'pain', label: 'Pain', icon: 'flash' },
  { id: 'appetite', label: 'Appetite Loss', icon: 'restaurant' },
];

const CHECKBOX_SYMPTOMS = [
  { id: 'has_fever', label: 'Fever' },
  { id: 'has_mouth_sores', label: 'Mouth Sores' },
  { id: 'has_diarrhea', label: 'Diarrhea' },
  { id: 'has_constipation', label: 'Constipation' },
  { id: 'has_numbness', label: 'Numbness/Tingling' },
  { id: 'has_hair_loss', label: 'Hair Loss' },
  { id: 'has_skin_changes', label: 'Skin Changes' },
];

export default function PatientSymptomsScreen() {
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<SymptomCreate>>({
    nausea_score: undefined,
    fatigue_score: undefined,
    pain_score: undefined,
    appetite_score: undefined,
    vomiting_count: undefined,
    has_fever: false,
    has_mouth_sores: false,
    has_diarrhea: false,
    has_constipation: false,
    has_numbness: false,
    has_hair_loss: false,
    has_skin_changes: false,
    other_symptoms: '',
    mood_notes: '',
  });

  const loadSymptoms = async () => {
    try {
      const data = await symptomsService.getMySymptoms(20);
      setSymptoms(data);
    } catch (error: any) {
      console.error('Error loading symptoms:', error);
      if (error.response?.status !== 404) {
        // Silent fail for symptoms
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSymptoms();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSymptoms();
    setRefreshing(false);
  }, []);

  const resetForm = () => {
    setFormData({
      nausea_score: undefined,
      fatigue_score: undefined,
      pain_score: undefined,
      appetite_score: undefined,
      vomiting_count: undefined,
      has_fever: false,
      has_mouth_sores: false,
      has_diarrhea: false,
      has_constipation: false,
      has_numbness: false,
      has_hair_loss: false,
      has_skin_changes: false,
      other_symptoms: '',
      mood_notes: '',
    });
  };

  const handleSaveSymptoms = async () => {
    setIsSaving(true);
    try {
      const result = await symptomsService.logMySymptoms(formData);
      
      // Show AI assessment
      if (result.aiAlertLevel === 'urgent') {
        Alert.alert(
          '🚨 Urgent Alert',
          result.aiRecommendations || 'Please contact your care team immediately.',
          [{ text: 'OK', style: 'destructive' }]
        );
      } else if (result.aiAlertLevel === 'monitor') {
        Alert.alert(
          '⚠️ Monitor These Symptoms',
          result.aiRecommendations || 'Keep tracking and contact your doctor if symptoms worsen.',
        );
      } else {
        Alert.alert('Logged', 'Symptoms recorded successfully');
      }
      
      setShowLogModal(false);
      resetForm();
      await loadSymptoms();
    } catch (error: any) {
      console.error('Error saving symptoms:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save symptoms');
    } finally {
      setIsSaving(false);
    }
  };

  const getAlertColor = (level?: string) => {
    switch (level) {
      case 'urgent': return colors.error;
      case 'monitor': return colors.warning;
      default: return colors.success;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const ScoreSelector = ({ 
    label, 
    value, 
    onChange 
  }: { 
    label: string; 
    value?: number; 
    onChange: (v: number | undefined) => void 
  }) => (
    <View style={styles.scoreSelector}>
      <Text style={styles.scoreSelectorLabel}>{label}</Text>
      <View style={styles.scoreButtons}>
        {[0, 2, 4, 6, 8, 10].map((score) => (
          <TouchableOpacity
            key={score}
            style={[
              styles.scoreButton,
              value === score && styles.scoreButtonActive,
              score >= 8 && styles.scoreButtonHigh,
              score >= 8 && value === score && styles.scoreButtonHighActive,
            ]}
            onPress={() => onChange(value === score ? undefined : score)}
          >
            <Text style={[
              styles.scoreButtonText,
              value === score && styles.scoreButtonTextActive,
            ]}>
              {score}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.scoreLabels}>
        <Text style={styles.scoreLabel}>None</Text>
        <Text style={styles.scoreLabel}>Severe</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Symptom Diary" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Symptom Diary"
        rightComponent={
          <TouchableOpacity onPress={() => setShowLogModal(true)}>
            <Ionicons name="add-circle" size={28} color={colors.primary[500]} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Quick Log Card */}
        <Card variant="elevated" padding="large" style={styles.quickLogCard}>
          <Text style={styles.quickLogTitle}>How are you feeling today?</Text>
          <Text style={styles.quickLogSubtitle}>
            Track your symptoms to help your care team monitor your progress
          </Text>
          <Button
            title="Log Today's Symptoms"
            variant="primary"
            size="large"
            onPress={() => setShowLogModal(true)}
            fullWidth
          />
        </Card>

        {/* History */}
        <Text style={styles.sectionTitle}>Recent Entries</Text>
        
        {symptoms.length === 0 ? (
          <Card variant="default" padding="large">
            <View style={styles.emptyState}>
              <Ionicons name="journal-outline" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>No entries yet</Text>
              <Text style={styles.emptySubtext}>
                Start tracking your symptoms to help your care team
              </Text>
            </View>
          </Card>
        ) : (
          symptoms.map((entry, index) => (
            <Card key={entry.id || index} variant="default" padding="medium" style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>{formatDate(entry.recordedAt)}</Text>
                {entry.aiAlertLevel && (
                  <View style={[styles.alertBadge, { backgroundColor: getAlertColor(entry.aiAlertLevel) }]}>
                    <Text style={styles.alertBadgeText}>
                      {entry.aiAlertLevel === 'urgent' ? '🚨 Urgent' : 
                       entry.aiAlertLevel === 'monitor' ? '⚠️ Monitor' : '✓ Normal'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.entryScores}>
                {entry.nauseaScore !== undefined && entry.nauseaScore !== null && (
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreValue}>{entry.nauseaScore}</Text>
                    <Text style={styles.scoreLabel}>Nausea</Text>
                  </View>
                )}
                {entry.fatigueScore !== undefined && entry.fatigueScore !== null && (
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreValue}>{entry.fatigueScore}</Text>
                    <Text style={styles.scoreLabel}>Fatigue</Text>
                  </View>
                )}
                {entry.painScore !== undefined && entry.painScore !== null && (
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreValue}>{entry.painScore}</Text>
                    <Text style={styles.scoreLabel}>Pain</Text>
                  </View>
                )}
                {entry.appetiteScore !== undefined && entry.appetiteScore !== null && (
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreValue}>{entry.appetiteScore}</Text>
                    <Text style={styles.scoreLabel}>Appetite</Text>
                  </View>
                )}
              </View>

              {/* Boolean symptoms */}
              <View style={styles.symptomTags}>
                {entry.hasFever && <Text style={styles.symptomTag}>🤒 Fever</Text>}
                {entry.hasMouthSores && <Text style={styles.symptomTag}>😣 Mouth Sores</Text>}
                {entry.hasDiarrhea && <Text style={styles.symptomTag}>🚻 Diarrhea</Text>}
                {entry.hasConstipation && <Text style={styles.symptomTag}>Constipation</Text>}
                {entry.hasNumbness && <Text style={styles.symptomTag}>🔌 Numbness</Text>}
              </View>

              {entry.aiRecommendations && (
                <View style={styles.recommendationBox}>
                  <Ionicons name="bulb-outline" size={16} color={colors.primary[500]} />
                  <Text style={styles.recommendationText}>{entry.aiRecommendations}</Text>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Log Symptoms Modal */}
      <Modal
        visible={showLogModal}
        onClose={() => {
          setShowLogModal(false);
          resetForm();
        }}
        title="Log Symptoms"
      >
        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalSubtitle}>
            Rate your symptoms from 0 (none) to 10 (severe)
          </Text>

          <ScoreSelector
            label="Nausea"
            value={formData.nausea_score}
            onChange={(v) => setFormData({ ...formData, nausea_score: v })}
          />

          <ScoreSelector
            label="Fatigue"
            value={formData.fatigue_score}
            onChange={(v) => setFormData({ ...formData, fatigue_score: v })}
          />

          <ScoreSelector
            label="Pain"
            value={formData.pain_score}
            onChange={(v) => setFormData({ ...formData, pain_score: v })}
          />

          <ScoreSelector
            label="Appetite Loss"
            value={formData.appetite_score}
            onChange={(v) => setFormData({ ...formData, appetite_score: v })}
          />

          <Text style={styles.checkboxTitle}>Other Symptoms</Text>
          {CHECKBOX_SYMPTOMS.map((symptom) => (
            <TouchableOpacity
              key={symptom.id}
              style={styles.checkboxRow}
              onPress={() => setFormData({ 
                ...formData, 
                [symptom.id]: !formData[symptom.id as keyof typeof formData]
              })}
            >
              <View style={[
                styles.checkbox,
                Boolean(formData[symptom.id as keyof typeof formData]) && styles.checkboxChecked
              ]}>
                {Boolean(formData[symptom.id as keyof typeof formData]) && (
                  <Ionicons name="checkmark" size={16} color={colors.neutral[0]} />
                )}
              </View>
              <Text style={styles.checkboxLabel}>{symptom.label}</Text>
            </TouchableOpacity>
          ))}

          <Input
            label="Other symptoms"
            placeholder="Describe any other symptoms..."
            value={formData.other_symptoms || ''}
            onChangeText={(v) => setFormData({ ...formData, other_symptoms: v })}
            multiline
            numberOfLines={2}
          />

          <Input
            label="How is your mood?"
            placeholder="Any emotional changes or concerns..."
            value={formData.mood_notes || ''}
            onChangeText={(v) => setFormData({ ...formData, mood_notes: v })}
            multiline
            numberOfLines={2}
          />

          <Button
            title="Save Entry"
            variant="primary"
            size="large"
            onPress={handleSaveSymptoms}
            loading={isSaving}
            fullWidth
            style={styles.saveButton}
          />
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  quickLogCard: {
    marginBottom: spacing.lg,
  },
  quickLogTitle: {
    fontSize: typography.title3.fontSize,
    fontWeight: typography.title3.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  quickLogSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  entryCard: {
    marginBottom: spacing.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  entryDate: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
  },
  alertBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  alertBadgeText: {
    fontSize: typography.caption2.fontSize,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  entryScores: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: typography.title3.fontSize,
    fontWeight: '700',
    color: colors.text.primary,
  },
  symptomTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  symptomTag: {
    fontSize: typography.caption2.fontSize,
    color: colors.text.secondary,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  recommendationText: {
    flex: 1,
    fontSize: typography.caption1.fontSize,
    color: colors.primary[700],
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  scoreSelector: {
    marginBottom: spacing.lg,
  },
  scoreSelectorLabel: {
    fontSize: typography.callout.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  scoreButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreButtonActive: {
    backgroundColor: colors.primary[500],
  },
  scoreButtonHigh: {
    backgroundColor: colors.warning + '30',
  },
  scoreButtonHighActive: {
    backgroundColor: colors.error,
  },
  scoreButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  scoreButtonTextActive: {
    color: colors.neutral[0],
  },
  scoreLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  scoreLabel: {
    fontSize: typography.caption2.fontSize,
    color: colors.text.tertiary,
  },
  checkboxTitle: {
    fontSize: typography.callout.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  checkboxLabel: {
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
