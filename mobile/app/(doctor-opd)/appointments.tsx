/**
 * Doctor OPD Appointments - Full appointments list with management
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Card, Avatar, Badge, Button, Header } from '../../src/components';
import { doctorService, AppointmentAPI, PatientSummaryAPI } from '../../src/services/doctorService';

interface AppointmentWithPatient extends AppointmentAPI {
  patientName?: string;
  patientPhoto?: string;
}

export default function DoctorOPDAppointmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [patients, setPatients] = useState<Record<string, PatientSummaryAPI>>({});
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [appointmentsData, patientsData] = await Promise.all([
        doctorService.getAppointments(),
        doctorService.getPatients({ limit: 200 }),
      ]);

      // Create patient lookup map
      const patientMap: Record<string, PatientSummaryAPI> = {};
      patientsData.forEach(p => {
        patientMap[p.id] = p;
      });
      setPatients(patientMap);

      // Add patient names to appointments
      const appointmentsWithNames = appointmentsData.map(apt => ({
        ...apt,
        patientName: patientMap[apt.patientId]
          ? `${patientMap[apt.patientId].firstName} ${patientMap[apt.patientId].lastName}`
          : 'Unknown Patient',
        patientPhoto: patientMap[apt.patientId]?.profilePhotoUrl,
      }));

      // Sort by date/time (newest first)
      appointmentsWithNames.sort((a, b) => {
        const dateA = `${a.scheduledDate}T${a.scheduledTime}`;
        const dateB = `${b.scheduledDate}T${b.scheduledTime}`;
        return dateB.localeCompare(dateA);
      });

      setAppointments(appointmentsWithNames);
    } catch (error) {
      console.error('Error fetching appointments:', error);
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

  // Filter appointments
  const filteredAppointments = appointments.filter(apt => {
    const today = new Date().toISOString().split('T')[0];
    switch (filter) {
      case 'today':
        return apt.scheduledDate === today;
      case 'upcoming':
        return apt.scheduledDate >= today && ['scheduled', 'confirmed'].includes(apt.status);
      case 'completed':
        return apt.status === 'completed';
      default:
        return true;
    }
  });

  // Format helpers
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getAppointmentTypeLabel = (type: string) => {
    switch (type) {
      case 'opd_consultation': return 'OPD Consultation';
      case 'follow_up': return 'Follow-up';
      case 'chemotherapy': return 'Chemotherapy';
      case 'lab_work': return 'Lab Work';
      default: return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge label="Completed" variant="success" size="small" />;
      case 'confirmed':
        return <Badge label="Confirmed" variant="info" size="small" />;
      case 'scheduled':
        return <Badge label="Scheduled" variant="neutral" size="small" />;
      case 'in_progress':
        return <Badge label="In Progress" variant="warning" size="small" />;
      case 'checked_in':
        return <Badge label="Checked In" variant="info" size="small" />;
      case 'cancelled':
        return <Badge label="Cancelled" variant="error" size="small" />;
      default:
        return <Badge label={status} variant="neutral" size="small" />;
    }
  };

  const renderAppointment = ({ item }: { item: AppointmentWithPatient }) => (
    <TouchableOpacity style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <View style={styles.patientInfo}>
          <Avatar 
            name={item.patientName || 'Unknown'} 
            source={item.patientPhoto ? { uri: item.patientPhoto } : undefined}
            size="medium" 
          />
          <View style={styles.patientDetails}>
            <Text style={styles.patientName}>{item.patientName}</Text>
            <Text style={styles.appointmentType}>{getAppointmentTypeLabel(item.appointmentType)}</Text>
          </View>
        </View>
        {getStatusBadge(item.status)}
      </View>
      
      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatDate(item.scheduledDate)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatTime(item.scheduledTime)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="hourglass-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.durationMins} mins</Text>
        </View>
      </View>

      {item.notes && (
        <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
      )}
    </TouchableOpacity>
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
        <Text style={styles.loadingText}>Loading appointments...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header 
        title="Appointments" 
        showBackButton 
        onBackPress={() => router.back()}
      />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterButton label="All" value="all" />
        <FilterButton label="Today" value="today" />
        <FilterButton label="Upcoming" value="upcoming" />
        <FilterButton label="Completed" value="completed" />
      </View>

      <FlatList
        data={filteredAppointments}
        renderItem={renderAppointment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Appointments</Text>
            <Text style={styles.emptyText}>
              {filter === 'today' 
                ? 'No appointments scheduled for today'
                : filter === 'upcoming'
                ? 'No upcoming appointments'
                : filter === 'completed'
                ? 'No completed appointments yet'
                : 'No appointments found'}
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
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  appointmentCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  patientDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  patientName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  appointmentType: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  appointmentDetails: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  notes: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
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
