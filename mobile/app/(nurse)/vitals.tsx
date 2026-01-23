/**
 * Nurse Vitals Screen - Record and view patient vitals
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Avatar, Badge, Button, Header, Card } from '../../src/components';
import { doctorService, PatientSummaryAPI, VitalAPI } from '../../src/services/doctorService';

interface VitalEntry {
  id: string;
  patientId: string;
  patientName: string;
  recordedAt: string;
  temperature?: number;
  pulse?: number;
  bloodPressure?: string;
  oxygenSat?: number;
  weight?: number;
  painScore?: number;
  recordedBy: string;
}

interface VitalFormData {
  temperature_f?: string;
  pulse_bpm?: string;
  bp_systolic?: string;
  bp_diastolic?: string;
  oxygen_saturation?: string;
  weight_kg?: string;
  pain_score?: string;
  notes?: string;
}

export default function NurseVitalsScreen() {
  const insets = useSafeAreaInsets();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patients, setPatients] = useState<PatientSummaryAPI[]>([]);
  const [recentVitals, setRecentVitals] = useState<VitalEntry[]>([]);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSummaryAPI | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<VitalFormData>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [patientsData] = await Promise.all([
        doctorService.getPatients({ limit: 50 }),
      ]);
      setPatients(patientsData);
      
      // Mock recent vitals - in production would come from vitals API
      const mockRecentVitals: VitalEntry[] = [
        {
          id: '1',
          patientId: 'p1',
          patientName: 'Raj Kumar',
          recordedAt: new Date().toISOString(),
          temperature: 98.4,
          pulse: 72,
          bloodPressure: '120/80',
          oxygenSat: 98,
          weight: 70,
          painScore: 2,
          recordedBy: 'Nurse Singh',
        },
        {
          id: '2',
          patientId: 'p2',
          patientName: 'Priya Sharma',
          recordedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          temperature: 99.1,
          pulse: 88,
          bloodPressure: '118/76',
          oxygenSat: 97,
          weight: 55,
          painScore: 4,
          recordedBy: 'Nurse Singh',
        },
      ];
      setRecentVitals(mockRecentVitals);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Open record modal for a patient
  const openRecordModal = (patient: PatientSummaryAPI) => {
    setSelectedPatient(patient);
    setFormData({});
    setShowRecordModal(true);
  };

  // Save vitals
  const saveVitals = async () => {
    if (!selectedPatient) return;

    // Validate at least one vital is entered
    const hasValues = Object.values(formData).some(v => v && v.trim());
    if (!hasValues) {
      Alert.alert('Required', 'Please enter at least one vital sign');
      return;
    }

    setSaving(true);
    try {
      const vitalsData: any = {};
      if (formData.temperature_f) vitalsData.temperature_f = parseFloat(formData.temperature_f);
      if (formData.pulse_bpm) vitalsData.pulse_bpm = parseInt(formData.pulse_bpm);
      if (formData.bp_systolic) vitalsData.blood_pressure_systolic = parseInt(formData.bp_systolic);
      if (formData.bp_diastolic) vitalsData.blood_pressure_diastolic = parseInt(formData.bp_diastolic);
      if (formData.oxygen_saturation) vitalsData.oxygen_saturation = parseInt(formData.oxygen_saturation);
      if (formData.weight_kg) vitalsData.weight_kg = parseFloat(formData.weight_kg);
      if (formData.pain_score) vitalsData.pain_score = parseInt(formData.pain_score);
      if (formData.notes) vitalsData.notes = formData.notes;

      await doctorService.recordVitals(selectedPatient.id, vitalsData);
      
      // Add to recent vitals
      const patientFullName = `${selectedPatient.firstName} ${selectedPatient.lastName}`;
      const newEntry: VitalEntry = {
        id: Date.now().toString(),
        patientId: selectedPatient.id,
        patientName: patientFullName,
        recordedAt: new Date().toISOString(),
        temperature: vitalsData.temperature_f,
        pulse: vitalsData.pulse_bpm,
        bloodPressure: vitalsData.blood_pressure_systolic 
          ? `${vitalsData.blood_pressure_systolic}/${vitalsData.blood_pressure_diastolic || '?'}`
          : undefined,
        oxygenSat: vitalsData.oxygen_saturation,
        weight: vitalsData.weight_kg,
        painScore: vitalsData.pain_score,
        recordedBy: 'You',
      };
      setRecentVitals(prev => [newEntry, ...prev]);

      setShowRecordModal(false);
      Alert.alert('Success', 'Vitals recorded successfully');
    } catch (error) {
      console.error('Error saving vitals:', error);
      Alert.alert('Error', 'Failed to save vitals');
    } finally {
      setSaving(false);
    }
  };

  // Filter patients by search
  const filteredPatients = patients.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  // Get pain score color
  const getPainScoreColor = (score: number) => {
    if (score <= 3) return Colors.success;
    if (score <= 6) return Colors.warning;
    return Colors.error;
  };

  const renderRecentVital = ({ item }: { item: VitalEntry }) => (
    <Card variant="default" padding="medium" style={styles.vitalCard}>
      <View style={styles.vitalHeader}>
        <View style={styles.patientInfo}>
          <Avatar name={item.patientName} size="small" />
          <View style={styles.patientDetails}>
            <Text style={styles.patientName}>{item.patientName}</Text>
            <Text style={styles.recordedTime}>{formatTimeAgo(item.recordedAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.vitalsGrid}>
        {item.temperature && (
          <View style={styles.vitalItem}>
            <Ionicons name="thermometer-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.vitalValue}>{item.temperature}°F</Text>
          </View>
        )}
        {item.pulse && (
          <View style={styles.vitalItem}>
            <Ionicons name="heart-outline" size={16} color={Colors.error} />
            <Text style={styles.vitalValue}>{item.pulse} bpm</Text>
          </View>
        )}
        {item.bloodPressure && (
          <View style={styles.vitalItem}>
            <Ionicons name="pulse-outline" size={16} color={Colors.primary} />
            <Text style={styles.vitalValue}>{item.bloodPressure}</Text>
          </View>
        )}
        {item.oxygenSat && (
          <View style={styles.vitalItem}>
            <Ionicons name="water-outline" size={16} color={Colors.info} />
            <Text style={styles.vitalValue}>{item.oxygenSat}% SpO₂</Text>
          </View>
        )}
        {item.painScore !== undefined && (
          <View style={styles.vitalItem}>
            <View style={[styles.painIndicator, { backgroundColor: getPainScoreColor(item.painScore) }]} />
            <Text style={styles.vitalValue}>Pain: {item.painScore}/10</Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderPatientToRecord = ({ item }: { item: PatientSummaryAPI }) => {
    const fullName = `${item.firstName} ${item.lastName}`;
    return (
      <TouchableOpacity 
        style={styles.patientRow}
        onPress={() => openRecordModal(item)}
      >
        <Avatar name={fullName} size="small" />
        <View style={styles.patientRowInfo}>
          <Text style={styles.patientRowName}>{fullName}</Text>
          <Text style={styles.patientRowMeta}>
            {item.cancerType || 'No diagnosis'}
          </Text>
        </View>
        <View style={styles.recordButton}>
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const VitalInput = ({ 
    label, 
    field, 
    placeholder, 
    unit,
    keyboardType = 'numeric' as any,
  }: { 
    label: string; 
    field: keyof VitalFormData; 
    placeholder: string;
    unit?: string;
    keyboardType?: any;
  }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={formData[field] || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, [field]: text }))}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          keyboardType={keyboardType}
        />
        {unit && <Text style={styles.inputUnit}>{unit}</Text>}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Vitals Recording" />

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Recent Vitals Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Recordings</Text>
          {recentVitals.length > 0 ? (
            recentVitals.map(vital => (
              <View key={vital.id}>
                {renderRecentVital({ item: vital })}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No vitals recorded today</Text>
          )}
        </View>

        {/* Record Vitals Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Record Vitals</Text>
          
          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patients..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {filteredPatients.slice(0, 10).map(patient => (
            <View key={patient.id}>
              {renderPatientToRecord({ item: patient })}
            </View>
          ))}
          
          {filteredPatients.length > 10 && (
            <Text style={styles.moreText}>
              +{filteredPatients.length - 10} more patients
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Record Vitals Modal */}
      <Modal
        visible={showRecordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRecordModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Vitals</Text>
              <TouchableOpacity onPress={() => setShowRecordModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedPatient && (
              <View style={styles.selectedPatient}>
                <Avatar name={`${selectedPatient.firstName} ${selectedPatient.lastName}`} size="medium" />
                <Text style={styles.selectedPatientName}>{selectedPatient.firstName} {selectedPatient.lastName}</Text>
              </View>
            )}

            <ScrollView style={styles.formScroll}>
              <View style={styles.formRow}>
                <VitalInput 
                  label="Temperature" 
                  field="temperature_f" 
                  placeholder="98.6" 
                  unit="°F" 
                />
                <VitalInput 
                  label="Pulse" 
                  field="pulse_bpm" 
                  placeholder="72" 
                  unit="bpm" 
                />
              </View>

              <View style={styles.formRow}>
                <VitalInput 
                  label="BP Systolic" 
                  field="bp_systolic" 
                  placeholder="120" 
                  unit="mmHg" 
                />
                <VitalInput 
                  label="BP Diastolic" 
                  field="bp_diastolic" 
                  placeholder="80" 
                  unit="mmHg" 
                />
              </View>

              <View style={styles.formRow}>
                <VitalInput 
                  label="Oxygen Sat" 
                  field="oxygen_saturation" 
                  placeholder="98" 
                  unit="%" 
                />
                <VitalInput 
                  label="Weight" 
                  field="weight_kg" 
                  placeholder="70" 
                  unit="kg" 
                />
              </View>

              <View style={styles.formRow}>
                <VitalInput 
                  label="Pain Score (0-10)" 
                  field="pain_score" 
                  placeholder="0" 
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={formData.notes || ''}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                  placeholder="Additional notes..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowRecordModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={saveVitals}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Vitals</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  vitalCard: {
    marginBottom: Spacing.sm,
  },
  vitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientDetails: {
    marginLeft: Spacing.sm,
  },
  patientName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  recordedTime: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  vitalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  vitalValue: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  painIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
    paddingVertical: 4,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    ...Shadows.small,
  },
  patientRowInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  patientRowName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  patientRowMeta: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  recordButton: {
    padding: 4,
  },
  moreText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
    paddingBottom: 34, // Safe area
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  selectedPatient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
  },
  selectedPatientName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
  },
  formScroll: {
    padding: Spacing.lg,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  inputUnit: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    paddingRight: Spacing.md,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
});
