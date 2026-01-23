/**
 * Nurse Medications Screen - Drug administration tracking
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Avatar, Badge, Button, Header, Card } from '../../src/components';
import { doctorService, AppointmentAPI, PatientSummaryAPI } from '../../src/services/doctorService';

interface MedicationItem {
  id: string;
  patientId: string;
  patientName: string;
  drugName: string;
  dose: string;
  route: string;
  status: 'pending' | 'in_progress' | 'completed' | 'held';
  scheduledTime: string;
  notes?: string;
}

// Mock medication data - in production this would come from treatment cycles API
const MOCK_MEDICATIONS: MedicationItem[] = [
  {
    id: '1',
    patientId: 'p1',
    patientName: 'Raj Kumar',
    drugName: 'Ondansetron',
    dose: '8mg IV',
    route: 'IV Push',
    status: 'pending',
    scheduledTime: '09:00',
    notes: 'Pre-medication - give 30 min before chemo',
  },
  {
    id: '2',
    patientId: 'p1',
    patientName: 'Raj Kumar',
    drugName: 'Dexamethasone',
    dose: '12mg IV',
    route: 'IV Push',
    status: 'pending',
    scheduledTime: '09:00',
    notes: 'Pre-medication',
  },
  {
    id: '3',
    patientId: 'p1',
    patientName: 'Raj Kumar',
    drugName: 'Oxaliplatin',
    dose: '130mg/m²',
    route: 'IV Infusion',
    status: 'pending',
    scheduledTime: '09:30',
    notes: '2-hour infusion - watch for cold sensitivity',
  },
  {
    id: '4',
    patientId: 'p2',
    patientName: 'Priya Sharma',
    drugName: 'Paclitaxel',
    dose: '175mg/m²',
    route: 'IV Infusion',
    status: 'in_progress',
    scheduledTime: '08:00',
    notes: '3-hour infusion - monitor for hypersensitivity',
  },
  {
    id: '5',
    patientId: 'p3',
    patientName: 'Amit Patel',
    drugName: '5-Fluorouracil',
    dose: '400mg/m²',
    route: 'IV Bolus',
    status: 'completed',
    scheduledTime: '07:30',
  },
];

export default function NurseMedicationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      // In production, this would fetch from treatment cycles/drug administrations API
      // For now, use mock data
      setMedications(MOCK_MEDICATIONS);
    } catch (error) {
      console.error('Error fetching medications:', error);
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

  // Filter medications
  const filteredMedications = medications.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  // Group by patient
  const groupedMedications = filteredMedications.reduce((acc, med) => {
    if (!acc[med.patientId]) {
      acc[med.patientId] = {
        patientName: med.patientName,
        medications: [],
      };
    }
    acc[med.patientId].medications.push(med);
    return acc;
  }, {} as Record<string, { patientName: string; medications: MedicationItem[] }>);

  // Update medication status
  const updateStatus = (medId: string, newStatus: MedicationItem['status']) => {
    setMedications(prev => 
      prev.map(m => m.id === medId ? { ...m, status: newStatus } : m)
    );
    
    const statusMessages = {
      in_progress: 'Administration started',
      completed: 'Administration completed',
      held: 'Medication held',
      pending: 'Status reset to pending',
    };
    Alert.alert('Updated', statusMessages[newStatus]);
  };

  // Get status badge
  const getStatusBadge = (status: MedicationItem['status']) => {
    switch (status) {
      case 'completed':
        return <Badge label="Completed" variant="success" size="small" />;
      case 'in_progress':
        return <Badge label="In Progress" variant="warning" size="small" />;
      case 'held':
        return <Badge label="Held" variant="error" size="small" />;
      default:
        return <Badge label="Pending" variant="neutral" size="small" />;
    }
  };

  // Get route icon
  const getRouteIcon = (route: string) => {
    if (route.includes('IV')) return 'water-outline';
    if (route.includes('PO') || route.includes('Oral')) return 'medical-outline';
    if (route.includes('SC')) return 'bandage-outline';
    return 'flask-outline';
  };

  const renderMedicationGroup = ({ item: patientId }: { item: string }) => {
    const group = groupedMedications[patientId];
    
    return (
      <Card variant="default" padding="medium" style={styles.patientCard}>
        <View style={styles.patientHeader}>
          <Avatar name={group.patientName} size="medium" />
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{group.patientName}</Text>
            <Text style={styles.medCount}>
              {group.medications.length} medication{group.medications.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {group.medications.map((med) => (
          <View key={med.id} style={styles.medicationItem}>
            <View style={styles.medHeader}>
              <View style={styles.medInfo}>
                <View style={[styles.routeIcon, { backgroundColor: `${Colors.primary}15` }]}>
                  <Ionicons name={getRouteIcon(med.route) as any} size={16} color={Colors.primary} />
                </View>
                <View style={styles.medDetails}>
                  <Text style={styles.drugName}>{med.drugName}</Text>
                  <Text style={styles.doseInfo}>{med.dose} • {med.route}</Text>
                </View>
              </View>
              {getStatusBadge(med.status)}
            </View>
            
            <View style={styles.medMeta}>
              <View style={styles.timeInfo}>
                <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.timeText}>{med.scheduledTime}</Text>
              </View>
              {med.notes && (
                <Text style={styles.notes} numberOfLines={1}>{med.notes}</Text>
              )}
            </View>

            {med.status === 'pending' && (
              <View style={styles.medActions}>
                <TouchableOpacity 
                  style={styles.startButton}
                  onPress={() => updateStatus(med.id, 'in_progress')}
                >
                  <Ionicons name="play-circle-outline" size={18} color={Colors.white} />
                  <Text style={styles.startButtonText}>Start</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.holdButton}
                  onPress={() => updateStatus(med.id, 'held')}
                >
                  <Ionicons name="pause-circle-outline" size={18} color={Colors.warning} />
                  <Text style={styles.holdButtonText}>Hold</Text>
                </TouchableOpacity>
              </View>
            )}

            {med.status === 'in_progress' && (
              <View style={styles.medActions}>
                <TouchableOpacity 
                  style={styles.completeButton}
                  onPress={() => updateStatus(med.id, 'completed')}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />
                  <Text style={styles.completeButtonText}>Complete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </Card>
    );
  };

  const FilterButton = ({ label, value, count }: { label: string; value: typeof filter; count: number }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterButtonText, filter === value && styles.filterButtonTextActive]}>
        {label}
      </Text>
      <View style={[styles.filterCount, filter === value && styles.filterCountActive]}>
        <Text style={[styles.filterCountText, filter === value && styles.filterCountTextActive]}>
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const counts = {
    all: medications.length,
    pending: medications.filter(m => m.status === 'pending').length,
    in_progress: medications.filter(m => m.status === 'in_progress').length,
    completed: medications.filter(m => m.status === 'completed').length,
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading medications...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header 
        title="Medications" 
        showBackButton 
        onBackPress={() => router.back()}
      />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterButton label="All" value="all" count={counts.all} />
        <FilterButton label="Pending" value="pending" count={counts.pending} />
        <FilterButton label="Active" value="in_progress" count={counts.in_progress} />
        <FilterButton label="Done" value="completed" count={counts.completed} />
      </View>

      <FlatList
        data={Object.keys(groupedMedications)}
        renderItem={renderMedicationGroup}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="medical-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Medications</Text>
            <Text style={styles.emptyText}>
              {filter === 'pending' ? 'No pending medications' : 
               filter === 'in_progress' ? 'No active infusions' :
               filter === 'completed' ? 'No completed medications yet' :
               'No medications scheduled today'}
            </Text>
          </View>
        }
      />
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
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
  filterCount: {
    backgroundColor: Colors.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterCountText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  filterCountTextActive: {
    color: Colors.white,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  patientCard: {
    marginBottom: Spacing.md,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  patientInfo: {
    marginLeft: Spacing.md,
  },
  patientName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  medCount: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  medicationItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  medHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  medInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  medDetails: {
    flex: 1,
  },
  drugName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  doseInfo: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  medMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.md,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  notes: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  medActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  startButtonText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  holdButton: {
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
  holdButtonText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.warning,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.success,
  },
  completeButtonText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
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
});
