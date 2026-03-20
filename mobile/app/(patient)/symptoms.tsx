/**
 * Patient Symptom Check-in
 * Friendly, emoji-based symptom tracking with smart follow-ups
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Header, Button } from '../../src/components';
import { symptomsService } from '../../src/services/symptomsService';
import type { SymptomEntry } from '../../src/types';

const MOOD_OPTIONS = [
  { emoji: '\u{1F60A}', label: 'Great', color: '#22C55E', scores: { nausea: 0, fatigue: 0, pain: 0, appetite: 0 } },
  { emoji: '\u{1F642}', label: 'Good', color: '#84CC16', scores: { nausea: 1, fatigue: 2, pain: 1, appetite: 1 } },
  { emoji: '\u{1F610}', label: 'Okay', color: '#F59E0B', scores: { nausea: 3, fatigue: 4, pain: 3, appetite: 3 } },
  { emoji: '\u{1F614}', label: 'Not Great', color: '#F97316', scores: { nausea: 5, fatigue: 6, pain: 5, appetite: 5 } },
  { emoji: '\u{1F623}', label: 'Bad', color: '#EF4444', scores: { nausea: 7, fatigue: 8, pain: 7, appetite: 7 } },
  { emoji: '\u{1F198}', label: 'Very Bad', color: '#DC2626', scores: { nausea: 9, fatigue: 9, pain: 9, appetite: 9 } },
];

const SPECIFIC_SYMPTOMS = [
  { id: 'has_fever', label: 'Fever / Chills', emoji: '\u{1F912}', urgent: true },
  { id: 'has_mouth_sores', label: 'Mouth Sores', emoji: '\u{1F623}', urgent: false },
  { id: 'has_diarrhea', label: 'Diarrhea', emoji: '\u{1F4A7}', urgent: true },
  { id: 'has_constipation', label: 'Constipation', emoji: '\u{1F616}', urgent: false },
  { id: 'has_numbness', label: 'Numbness / Tingling', emoji: '\u{270B}', urgent: true },
  { id: 'has_hair_loss', label: 'Hair Loss', emoji: '\u{1F487}', urgent: false },
  { id: 'has_skin_changes', label: 'Skin Changes / Rash', emoji: '\u{1F534}', urgent: false },
];

type Step = 'mood' | 'details' | 'done';

export default function PatientSymptomsScreen() {
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check-in flow
  const [step, setStep] = useState<Step | null>(null);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [nauseaScore, setNauseaScore] = useState<number | null>(null);
  const [fatigueScore, setFatigueScore] = useState<number | null>(null);
  const [painScore, setPainScore] = useState<number | null>(null);
  const [appetiteScore, setAppetiteScore] = useState<number | null>(null);
  const [otherText, setOtherText] = useState('');
  const [moodText, setMoodText] = useState('');

  const loadSymptoms = async () => {
    try {
      const data = await symptomsService.getSymptoms(undefined, 20);
      setSymptoms(data);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSymptoms(); }, []);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSymptoms();
    setRefreshing(false);
  }, []);

  const startCheckin = () => {
    setStep('mood');
    setSelectedMood(null);
    setSelectedSymptoms(new Set());
    setNauseaScore(null);
    setFatigueScore(null);
    setPainScore(null);
    setAppetiteScore(null);
    setOtherText('');
    setMoodText('');
  };

  const selectMood = (index: number) => {
    setSelectedMood(index);
    const mood = MOOD_OPTIONS[index];
    setNauseaScore(mood.scores.nausea);
    setFatigueScore(mood.scores.fatigue);
    setPainScore(mood.scores.pain);
    setAppetiteScore(mood.scores.appetite);
    // Auto-advance to details
    setTimeout(() => setStep('details'), 300);
  };

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const data: any = {
        nausea_score: nauseaScore,
        fatigue_score: fatigueScore,
        pain_score: painScore,
        appetite_score: appetiteScore,
        has_fever: selectedSymptoms.has('has_fever'),
        has_mouth_sores: selectedSymptoms.has('has_mouth_sores'),
        has_diarrhea: selectedSymptoms.has('has_diarrhea'),
        has_constipation: selectedSymptoms.has('has_constipation'),
        has_numbness: selectedSymptoms.has('has_numbness'),
        has_hair_loss: selectedSymptoms.has('has_hair_loss'),
        has_skin_changes: selectedSymptoms.has('has_skin_changes'),
        other_symptoms: otherText || undefined,
        mood_notes: moodText || undefined,
      };
      const result = await symptomsService.logSymptoms(data);

      setStep('done');

      // Show urgent alert if needed
      if (result.aiAlertLevel === 'urgent') {
        setTimeout(() => {
          Alert.alert(
            'Important',
            'Based on your symptoms, we recommend contacting your care team today.\n\n' +
            (result.aiRecommendations || 'Please call the clinic if symptoms worsen.'),
            [
              { text: 'OK' },
              { text: 'Call Clinic', onPress: () => require('react-native').Linking.openURL('tel:18002436226') },
            ]
          );
        }, 500);
      }

      await loadSymptoms();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getAlertColor = (level?: string) => {
    if (level === 'urgent') return '#DC2626';
    if (level === 'monitor') return '#F59E0B';
    return '#22C55E';
  };
  const getAlertBg = (level?: string) => {
    if (level === 'urgent') return '#FEF2F2';
    if (level === 'monitor') return '#FFFBEB';
    return '#F0FDF4';
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getMoodEmoji = (entry: SymptomEntry) => {
    const avg = [entry.nauseaScore, entry.fatigueScore, entry.painScore, entry.appetiteScore]
      .filter(s => s != null)
      .reduce((a, b) => a! + b!, 0) as number;
    const count = [entry.nauseaScore, entry.fatigueScore, entry.painScore, entry.appetiteScore].filter(s => s != null).length;
    const mean = count > 0 ? avg / count : 0;
    if (mean <= 1) return '\u{1F60A}';
    if (mean <= 3) return '\u{1F642}';
    if (mean <= 5) return '\u{1F610}';
    if (mean <= 7) return '\u{1F614}';
    return '\u{1F623}';
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="How Are You Feeling?" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  // ============ CHECK-IN FLOW ============
  if (step === 'mood') {
    return (
      <View style={styles.container}>
        <Header title="Check-in" showBackButton onBackPress={() => setStep(null)} />
        <View style={styles.moodScreen}>
          <Text style={styles.moodQuestion}>How are you feeling{'\n'}right now?</Text>
          <View style={styles.moodGrid}>
            {MOOD_OPTIONS.map((mood, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.moodCard, selectedMood === i && { borderColor: mood.color, borderWidth: 3 }]}
                onPress={() => selectMood(i)}
                activeOpacity={0.7}
                accessibilityLabel={mood.label}
                accessibilityRole="button"
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={[styles.moodLabel, { color: mood.color }]}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (step === 'details') {
    const mood = selectedMood != null ? MOOD_OPTIONS[selectedMood] : null;
    return (
      <View style={styles.container}>
        <Header title="Tell Us More" showBackButton onBackPress={() => setStep('mood')} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {/* Selected mood summary */}
          {mood && (
            <View style={[styles.moodSummary, { backgroundColor: mood.color + '15', borderColor: mood.color + '30' }]}>
              <Text style={{ fontSize: 32 }}>{mood.emoji}</Text>
              <Text style={[styles.moodSummaryText, { color: mood.color }]}>Feeling {mood.label.toLowerCase()}</Text>
            </View>
          )}

          {/* Fine-tune scores */}
          <Text style={styles.detailTitle}>Adjust if needed</Text>
          {[
            { label: 'Nausea', value: nauseaScore, set: setNauseaScore, icon: '\u{1F922}' },
            { label: 'Fatigue', value: fatigueScore, set: setFatigueScore, icon: '\u{1F634}' },
            { label: 'Pain', value: painScore, set: setPainScore, icon: '\u{26A1}' },
            { label: 'Appetite Loss', value: appetiteScore, set: setAppetiteScore, icon: '\u{1F37D}\u{FE0F}' },
          ].map(item => (
            <View key={item.label} style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{item.icon} {item.label}</Text>
              <View style={styles.sliderTrack}>
                {[0, 2, 4, 6, 8, 10].map(v => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.sliderDot, item.value === v && styles.sliderDotActive,
                      v >= 8 && item.value === v && styles.sliderDotDanger]}
                    onPress={() => item.set(v)}
                  >
                    <Text style={[styles.sliderDotText, item.value === v && styles.sliderDotTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Specific symptoms */}
          <Text style={styles.detailTitle}>Are you experiencing any of these?</Text>
          <View style={styles.symptomChips}>
            {SPECIFIC_SYMPTOMS.map(s => {
              const selected = selectedSymptoms.has(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.symptomChip, selected && styles.symptomChipActive,
                    selected && s.urgent && styles.symptomChipUrgent]}
                  onPress={() => toggleSymptom(s.id)}
                  accessibilityLabel={s.label}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={styles.symptomChipEmoji}>{s.emoji}</Text>
                  <Text style={[styles.symptomChipText, selected && styles.symptomChipTextActive]}>{s.label}</Text>
                  {selected && s.urgent && <Ionicons name="warning" size={14} color="#DC2626" />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Free text */}
          <Text style={styles.detailTitle}>Anything else?</Text>
          <TextInput
            style={styles.textArea}
            value={otherText}
            onChangeText={setOtherText}
            placeholder="Any other symptoms or observations..."
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <TextInput
            style={styles.textArea}
            value={moodText}
            onChangeText={setMoodText}
            placeholder="How is your mood? Any worries or concerns..."
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, isSaving && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Check-in</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  if (step === 'done') {
    const mood = selectedMood != null ? MOOD_OPTIONS[selectedMood] : null;
    return (
      <View style={styles.container}>
        <View style={styles.doneScreen}>
          <Text style={{ fontSize: 64 }}>{mood?.emoji || '\u{2705}'}</Text>
          <Text style={styles.doneTitle}>Check-in Recorded</Text>
          <Text style={styles.doneSubtitle}>Your care team can now see how you're feeling. They'll reach out if anything needs attention.</Text>
          <Button title="Done" variant="primary" size="large" onPress={() => setStep(null)} style={{ marginTop: spacing.xl, minWidth: 200 }} />
        </View>
      </View>
    );
  }

  // ============ MAIN SCREEN (HISTORY) ============
  return (
    <View style={styles.container}>
      <Header title="How Are You Feeling?" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
      >
        {/* Check-in CTA */}
        <TouchableOpacity style={styles.checkinCard} onPress={startCheckin} activeOpacity={0.8}>
          <View style={styles.checkinLeft}>
            <Text style={styles.checkinEmoji}>{'\u{1F44B}'}</Text>
            <View>
              <Text style={styles.checkinTitle}>Daily Check-in</Text>
              <Text style={styles.checkinSubtitle}>Let your care team know how you're doing</Text>
            </View>
          </View>
          <View style={styles.checkinBtn}>
            <Ionicons name="add" size={24} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* History */}
        {symptoms.length > 0 && (
          <>
            <Text style={styles.historyTitle}>Recent Check-ins</Text>
            {symptoms.map((entry, i) => {
              const alertLevel = entry.aiAlertLevel || 'normal';
              const flags = [
                entry.hasFever && '\u{1F912} Fever',
                entry.hasMouthSores && '\u{1F623} Mouth sores',
                entry.hasDiarrhea && '\u{1F4A7} Diarrhea',
                entry.hasNumbness && '\u{270B} Numbness',
                entry.hasConstipation && '\u{1F616} Constipation',
              ].filter(Boolean);

              return (
                <View key={entry.id || i} style={[styles.historyCard, { borderLeftColor: getAlertColor(alertLevel) }]}>
                  <View style={styles.historyHeader}>
                    <View style={styles.historyMood}>
                      <Text style={{ fontSize: 24 }}>{getMoodEmoji(entry)}</Text>
                      <Text style={styles.historyDate}>{formatDate(entry.recordedAt)}</Text>
                    </View>
                    <View style={[styles.alertPill, { backgroundColor: getAlertBg(alertLevel) }]}>
                      <View style={[styles.alertDot, { backgroundColor: getAlertColor(alertLevel) }]} />
                      <Text style={[styles.alertPillText, { color: getAlertColor(alertLevel) }]}>
                        {alertLevel === 'urgent' ? 'Needs attention' : alertLevel === 'monitor' ? 'Monitoring' : 'All good'}
                      </Text>
                    </View>
                  </View>

                  {/* Score bars */}
                  <View style={styles.scoreBars}>
                    {[
                      { label: 'Nausea', val: entry.nauseaScore },
                      { label: 'Fatigue', val: entry.fatigueScore },
                      { label: 'Pain', val: entry.painScore },
                      { label: 'Appetite', val: entry.appetiteScore },
                    ].filter(s => s.val != null).map(s => (
                      <View key={s.label} style={styles.scoreBarRow}>
                        <Text style={styles.scoreBarLabel}>{s.label}</Text>
                        <View style={styles.scoreBarTrack}>
                          <View style={[styles.scoreBarFill, {
                            width: `${(s.val! / 10) * 100}%`,
                            backgroundColor: s.val! <= 3 ? '#22C55E' : s.val! <= 6 ? '#F59E0B' : '#EF4444',
                          }]} />
                        </View>
                        <Text style={styles.scoreBarValue}>{s.val}</Text>
                      </View>
                    ))}
                  </View>

                  {flags.length > 0 && (
                    <View style={styles.flagsRow}>
                      {flags.map((f, j) => (
                        <Text key={j} style={styles.flagChip}>{f}</Text>
                      ))}
                    </View>
                  )}

                  {entry.aiRecommendations && (
                    <View style={styles.aiBox}>
                      <Ionicons name="sparkles" size={14} color={colors.primary[500]} />
                      <Text style={styles.aiBoxText}>{entry.aiRecommendations}</Text>
                    </View>
                  )}

                  {entry.moodNotes && (
                    <Text style={styles.moodNote}>{'\u{1F4AD}'} {entry.moodNotes}</Text>
                  )}
                </View>
              );
            })}
          </>
        )}

        {symptoms.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>{'\u{1F4DD}'}</Text>
            <Text style={styles.emptyTitle}>No check-ins yet</Text>
            <Text style={styles.emptySubtitle}>Start your first daily check-in to help your care team track your recovery</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  // Check-in CTA
  checkinCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary[500], borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  checkinLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  checkinEmoji: { fontSize: 32 },
  checkinTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  checkinSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  checkinBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  // Mood selection
  moodScreen: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  moodQuestion: { fontSize: 28, fontWeight: '800', color: colors.text.primary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 36 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  moodCard: { width: '29%', aspectRatio: 1, backgroundColor: '#fff', borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border.light },
  moodEmoji: { fontSize: 36, marginBottom: spacing.xs },
  moodLabel: { fontSize: 13, fontWeight: '600' },

  // Details
  detailContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  moodSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.lg },
  moodSummaryText: { fontSize: 17, fontWeight: '600' },
  detailTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.md, marginTop: spacing.sm },
  sliderRow: { marginBottom: spacing.md },
  sliderLabel: { fontSize: 14, fontWeight: '500', color: colors.text.primary, marginBottom: spacing.xs },
  sliderTrack: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' },
  sliderDotActive: { backgroundColor: colors.primary[500] },
  sliderDotDanger: { backgroundColor: '#EF4444' },
  sliderDotText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  sliderDotTextActive: { color: '#fff' },
  symptomChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  symptomChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border.light },
  symptomChipActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  symptomChipUrgent: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  symptomChipEmoji: { fontSize: 16 },
  symptomChipText: { fontSize: 13, color: colors.text.secondary },
  symptomChipTextActive: { color: colors.text.primary, fontWeight: '600' },
  textArea: { backgroundColor: '#fff', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border.light, padding: spacing.md, fontSize: 14, color: colors.text.primary, minHeight: 70, marginBottom: spacing.md },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary[500], borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Done
  doneScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneTitle: { fontSize: 24, fontWeight: '800', color: colors.text.primary, marginTop: spacing.md },
  doneSubtitle: { fontSize: 15, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },

  // History
  historyTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.md },
  historyCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 4 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  historyMood: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyDate: { fontSize: 13, color: colors.text.secondary },
  alertPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 12 },
  alertDot: { width: 6, height: 6, borderRadius: 3 },
  alertPillText: { fontSize: 11, fontWeight: '600' },
  scoreBars: { gap: spacing.xs },
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreBarLabel: { fontSize: 11, color: colors.text.tertiary, width: 55 },
  scoreBarTrack: { flex: 1, height: 6, backgroundColor: colors.neutral[100], borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: 6, borderRadius: 3 },
  scoreBarValue: { fontSize: 12, fontWeight: '700', color: colors.text.primary, width: 20, textAlign: 'right' },
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  flagChip: { fontSize: 12, color: colors.text.secondary, backgroundColor: colors.neutral[100], paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 8 },
  aiBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.primary[50], borderRadius: borderRadius.md },
  aiBoxText: { flex: 1, fontSize: 12, color: colors.primary[700], lineHeight: 18 },
  moodNote: { fontSize: 13, color: colors.text.secondary, fontStyle: 'italic', marginTop: spacing.sm },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginTop: spacing.md },
  emptySubtitle: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xl, lineHeight: 20 },
});
