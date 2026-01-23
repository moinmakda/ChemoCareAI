/**
 * Nurse Patients Screen - Patient list with vitals quick-entry
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
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Avatar, Badge, Button, Header, Input } from '../../src/components';
import { nurseService, PatientSummaryAPI, AppointmentAPI } from '../../src/services/nurseService';
import { doctorService } from '../../src/services/doctorService';

interface PatientWithAppointment extends PatientSummaryAPI {
  todayAppointment?: AppointmentAPI;
  status?: 'awaiting' | 'active' | 'completed';
}

export default function NursePatientsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patients, setPatients] = useState<PatientWithAppointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'awaiting' | 'active' | 'completed'>('all');
  
  // Vitals modal state
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientWithAppointment | null>(null);
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitals, setVitals] = useState({
    temperature_f: '',
    pulse_bpm: '',
    bp_systolic: '',
    bp_diastolic: '',
    oxygen_saturation: '',
    weight_kg: '',
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [patientsData, appointmentsData] = await Promise.all([
        doctorService.getPatients({ limit: 200 }),
        doctorService.getTodayAppointments(),
      ]);

      // Create appointment lookup by patient_id
      const appointmentMap: Record<string, AppointmentAPI> = {};
      appointmentsData.forEach(apt => {
        appointmentMap[apt.patientId] = apt;
      });

      // Combine patients with today's appointments
      const patientsWithStatus: PatientWithAppointment[] = patientsData.map(p => {
        const apt = appointmentMap[p.id];
        let status: 'awaiting' | 'active' | 'completed' | undefined;
        
        if (apt) {
          if (apt.status === 'completed') status = 'completed';
          else if (apt.status === 'checked_in' || apt.status === 'in_progress') status = 'active';
          else status = 'awaiting';
        }

        return {
          ...p,
          todayAppointment: apt,
          status,
        };
      });

      // Sort: active first, then awaiting, then rest
      patientsWithStatus.sort((a, b) => {
        const order = { active: 0, awaiting: 1, completed: 2, undefined: 3 };
        return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
      });

      setPatients(patientsWithStatus);
    } catch (error) {
      console.error('Error fetching patients:', error);
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

  // Filter patients
  const filteredPatients = patients.filter(p => {
    // Search filter
    if (searchQuery) {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      if (!fullName.includes(searchQuery.toLowerCase())) return false;
    }
    // Status filter
    if (filter === 'all') return true;
    return p.status === filter;
  });

  // Open vitals modal
  const openVitalsModal = (patient: PatientWithAppointment) => {
    setSelectedPatient(patient);
    setVitals({
      temperature_f: '',
      pulse_bpm: '',
      bp_systolic: '',
      bp_diastolic: '',
      oxygen_saturation: '',
      weight_kg: '',
    });
    setShowVitalsModal(true);
  };

  // Save vitals
  const saveVitals = async () => {
    if (!selectedPatient) return;
    
    setSavingVitals(true);
    try {
      await doctorService.recordVitals(selectedPatient.id, {
        temperature_f: vitals.temperature_f ? parseFloat(vitals.temperature_f) : undefined,
        pulse_bpm: vitals.pulse_bpm ? parseInt(vitals.pulse_bpm) : undefined,
        blood_pressure_systolic: vitals.bp_systolic ? parseInt(vitals.bp_systolic) : undefined,
        blood_pressure_diastolic: vitals.bp_diastolic ? parseInt(vitals.bp_diastolic) : undefined,
        oxygen_saturation: vitals.oxygen_saturation ? parseInt(vitals.oxygen_saturation) : undefined,
        weight_kg: vitals.weight_kg ? parseFloat(vitals.weight_kg) : undefined,
      });
      
      Alert.alert('Success', 'Vitals recorded successfully');
      setShowVitalsModal(false);
      setSelectedPatient(null);
    } catch (error) {
      console.error('Error saving vitals:', error);
      Alert.alert('Error', 'Failed to save vitals. Please try again.');
    } finally {
      setSavingVitals(false);
    }
  };

  // Check in patient
  const handleCheckIn = async (patient: PatientWithAppointment) => {
    if (!patient.todayAppointment) return;
    
    try {
      await nurseService.checkInPatient(patient.todayAppointment.id);
      Alert.alert('Success', `${patient.firstName} checked in successfully`);
      fetchData();
    } catch (error) {
      console.error('Error checking in:', error);
      Alert.alert('Error', 'Failed to check in patient');
    }
  };

  // Get status badge
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge label="Active" variant="success" size="small" />;
      case 'awaiting':
        return <Badge label="Awaiting" variant="warning" size="small" />;
      case 'completed':
        return <Badge label="Completed" variant="neutral" size="small" />;
      default:
        return null;
    }
  };

  const renderPatient = ({ item }: { item: PatientWithAppointment }) => (
    <View style={styles.patientCard}>
      <View style={styles.patientHeader}>
        <Avatar 
          name={`${item.firstName} ${item.lastName}`}
          source={item.profilePhotoUrl ? { uri: item.profilePhotoUrl } : undefined}
          size="medium" 
        />
        <View style={styles.patientInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.patientName}>{item.firstName} {item.lastName}</Text>
            {getStatusBadge(item.status)}
          </View>
          {item.cancerType && (
            <Text style={styles.cancerInfo}>{item.cancerType} {item.cancerStage && `- ${item.cancerStage}`}</Text>
          )}
          {item.todayAppointment && (
            <View style={styles.appointmentInfo}>
              <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.appointmentTime}>
                {item.todayAppointment.scheduledTime.slice(0, 5)} - {item.todayAppointment.appointmentType.replace(/_/g, ' ')}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => openVitalsModal(item)}
        >
          <Ionicons name="fitness-outline" size={18} color={Colors.primary} />
          <Text style={styles.actionButtonText}>Vitals</Text>
        </TouchableOpacity>
        
        {item.status === 'awaiting' && item.todayAppointment && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.checkInButton]}
            onPress={() => handleCheckIn(item)}
          >
            <Ionicons name="log-in-outline" size={18} color={Colors.white} />
            <Text style={[styles.actionButtonText, styles.checkInButtonText]}>Check In</Text>
          </TouchableOpacity>
        )}
        
        {item.status === 'active' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.activeButton]}
          >
            <Ionicons name="medical-outline" size={18} color={Colors.success} />
            <Text style={[styles.actionButtonText, { color: Colors.success }]}>In Treatment</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const FilterButton = ({ label, value }: { label: string; value: typeof filter }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterButtonText, filter === value && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading patients...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header 
        title="Patients" 
        showBackButton 
        onBackPress={() => router.back()}
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterButton label="All" value="all" />
        <FilterButton label="Awaiting" value="awaiting" />
        <FilterButton label="Active" value="active" />
        <FilterButton label="Completed" value="completed" />
      </View>

      {/* Patient Count */}
      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={filteredPatients}
        renderItem={renderPatient}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Patients Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? `No patients matching "${searchQuery}"` : 'No patients available'}
            </Text>
          </View>
        }
      />

      {/* Vitals Entry Modal */}
      <Modal
        visible={showVitalsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVitalsModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowVitalsModal(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Record Vitals</Text>
            <TouchableOpacity onPress={saveVitals} disabled={savingVitals}>
              <Text style={[styles.saveButton, savingVitals && styles.saveButtonDisabled]}>
                {savingVitals ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedPatient && (
            <View style={styles.modalPatientInfo}>
              <Avatar name={`${selectedPatient.firstName} ${selectedPatient.lastName}`} size="large" />
              <Text style={styles.modalPatientName}>
                {selectedPatient.firstName} {selectedPatient.lastName}
              </Text>
            </View>
          )}

          <ScrollView style={styles.vitalsForm} contentContainerStyle={styles.vitalsFormContent}>
            <View style={styles.vitalRow}>
              <View style={styles.vitalInputContainer}>
                <Text style={styles.vitalLabel}>Temperature (°F)</Text>
                <TextInput
                  style={styles.vitalInput}
                  placeholder="98.6"
                  keyboardType="decimal-pad"
                  value={vitals.temperature_f}
                  onChangeText={(v) => setVitals(prev => ({ ...prev, temperature_f: v }))}
                />
              </View>
              <View style={styles.vitalInputContainer}>
                <Text style={styles.vitalLabel}>Pulse (BPM)</Text>
                <TextInput
                  style={styles.vitalInput}
                  placeholder="72"
                  keyboardType="number-pad"
                  value={vitals.pulse_bpm}
                  onChangeText={(v) => setVitals(prev => ({ ...prev, pulse_bpm: v }))}
                />
              </View>
            </View>

            <View style={styles.vitalRow}>
              <View style={styles.vitalInputContainer}>
                <Text style={styles.vitalLabel}>BP Systolic</Text>
                <TextInput
                  style={styles.vitalInput}
                  placeholder="120"
                  keyboardType="number-pad"
                  value={vitals.bp_systolic}
                  onChangeText={(v) => setVitals(prev => ({ ...prev, bp_systolic: v }))}
                />
              </View>
              <View style={styles.vitalInputContainer}>
                <Text style={styles.vitalLabel}>BP Diastolic</Text>
                <TextInput
                  style={styles.vitalInput}
                  placeholder="80"
                  keyboardType="number-pad"
                  value={vitals.bp_diastolic}
                  onChangeText={(v) => setVitals(prev => ({ ...prev, bp_diastolic: v }))}
                />
              </View>
            </View>

            <View style={styles.vitalRow}>
              <View style={styles.vitalInputContainer}>
                <Text style={styles.vitalLabel}>O2 Saturation (%)</Text>
                <TextInput
                  style={styles.vitalInput}
                  placeholder="98"
                  keyboardType="number-pad"
                  value={vitals.oxygen_saturation}
                  onChangeText={(v) => setVitals(prev => ({ ...prev, oxygen_saturation: v }))}
                />
              </View>
              <View style={styles.vitalInputContainer}>
                <Text style={styles.vitalLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.vitalInput}
                  placeholder="70.0"
                  keyboardType="decimal-pad"
                  value={vitals.weight_kg}
                  onChangeText={(v) => setVitals(prev => ({ ...prev, weight_kg: v }))}
                />
              </View>
            </View>
          </ScrollView>
        </View>
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
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSecondary,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  filterButtonTextActive: {
    color: Colors.white,
  },
  countContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  countText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  patientCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  patientInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  patientName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  cancerInfo: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  appointmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  appointmentTime: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSecondary,
  },
  actionButtonText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  checkInButton: {
    backgroundColor: Colors.primary,
  },
  checkInButtonText: {
    color: Colors.white,
  },
  activeButton: {
    backgroundColor: `${Colors.success}15`,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelButton: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },
  modalTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  saveButton: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.primary,
  },
  saveButtonDisabled: {
    color: Colors.textTertiary,
  },
  modalPatientInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  modalPatientName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  vitalsForm: {
    flex: 1,
  },
  vitalsFormContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  vitalRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  vitalInputContainer: {
    flex: 1,
  },
  vitalLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  vitalInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});
