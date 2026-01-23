/**
 * Nurse Home - Day care nursing dashboard with real API data
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Card, Avatar, Badge, Button } from '../../src/components';
import { useAuthStore } from '../../src/store/authStore';
import { nurseService, type PatientSummaryAPI, type AppointmentAPI, type NurseDashboardStats } from '../../src/services/nurseService';

export default function NurseHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<NurseDashboardStats>({
    assignedPatients: 0,
    pendingVitals: 0,
    pendingMedications: 0,
    completedToday: 0,
  });
  const [activeAppointments, setActiveAppointments] = useState<AppointmentAPI[]>([]);
  const [awaitingAppointments, setAwaitingAppointments] = useState<AppointmentAPI[]>([]);
  const [patients, setPatients] = useState<PatientSummaryAPI[]>([]);

  const loadData = async () => {
    try {
      const [dashStats, active, awaiting, patientList] = await Promise.all([
        nurseService.getDashboardStats(),
        nurseService.getActivePatients(),
        nurseService.getAwaitingPatients(),
        nurseService.getPatients({ limit: 100 }),
      ]);
      setStats(dashStats);
      setActiveAppointments(active);
      setAwaitingAppointments(awaiting);
      setPatients(patientList);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'checked_in': return 'Checked In';
      case 'scheduled': return 'Scheduled';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return hour12 + ':' + minutes + ' ' + ampm;
  };

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      return patient.firstName + ' ' + patient.lastName;
    }
    return 'Patient';
  };

  const handleCheckIn = async (appointmentId: string) => {
    try {
      await nurseService.checkInPatient(appointmentId);
      await loadData();
    } catch (error) {
      console.error('Error checking in patient:', error);
    }
  };

  const handleCheckOut = async (appointmentId: string) => {
    try {
      await nurseService.checkOutPatient(appointmentId);
      await loadData();
    } catch (error) {
      console.error('Error checking out patient:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Nursing Station</Text>
          <Text style={styles.headerSubtitle}>Welcome, {user?.fullName || 'Nurse'}</Text>
        </View>
        <Avatar source={user?.avatar ? { uri: user.avatar } : undefined} name={user?.fullName} size="medium" />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Stats Overview */}
        <View style={styles.statsRow}>
          <Card variant="default" padding="medium" style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="people" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.statValue}>{stats.assignedPatients}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </Card>
          <Card variant="default" padding="medium" style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.warningLight }]}>
              <Ionicons name="pulse" size={20} color={Colors.warning} />
            </View>
            <Text style={styles.statValue}>{stats.pendingVitals}</Text>
            <Text style={styles.statLabel}>Vitals Due</Text>
          </Card>
          <Card variant="default" padding="medium" style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.successLight }]}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            </View>
            <Text style={styles.statValue}>{stats.completedToday}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </Card>
        </View>

        {/* Active Patients */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Patients</Text>
        </View>

        {activeAppointments.length === 0 ? (
          <Card variant="default" padding="large" style={styles.emptyCard}>
            <Ionicons name="bed-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No active patients</Text>
          </Card>
        ) : (
          activeAppointments.map((apt) => (
            <Card key={apt.id} variant="default" padding="medium" style={styles.patientCard}>
              <View style={styles.patientHeader}>
                {apt.chairNumber && (
                  <View style={styles.chairBadge}>
                    <Text style={styles.chairNumber}>{apt.chairNumber}</Text>
                  </View>
                )}
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{getPatientName(apt.patientId)}</Text>
                  <Text style={styles.patientStatus}>{getStatusLabel(apt.status)}</Text>
                </View>
                <Badge
                  label={apt.status === 'in_progress' ? 'Infusing' : 'Ready'}
                  variant={apt.status === 'in_progress' ? 'success' : 'info'}
                  size="small"
                />
              </View>
              <View style={styles.patientActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(nurse)/vitals')}>
                  <Ionicons name="pulse" size={18} color={Colors.primary} />
                  <Text style={styles.actionText}>Vitals</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleCheckOut(apt.id)}>
                  <Ionicons name="exit-outline" size={18} color={Colors.warning} />
                  <Text style={styles.actionText}>Checkout</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        {/* Awaiting Check-in */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Awaiting Check-in</Text>
        </View>

        {awaitingAppointments.length === 0 ? (
          <Card variant="default" padding="large" style={styles.emptyCard}>
            <Ionicons name="time-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No patients waiting</Text>
          </Card>
        ) : (
          awaitingAppointments.slice(0, 5).map((apt) => (
            <Card key={apt.id} variant="default" padding="medium" style={styles.patientCard}>
              <View style={styles.patientHeader}>
                <View style={styles.timeBox}>
                  <Text style={styles.timeText}>{formatTime(apt.scheduledTime)}</Text>
                </View>
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{getPatientName(apt.patientId)}</Text>
                  <Text style={styles.patientStatus}>{apt.durationMins} min session</Text>
                </View>
              </View>
              <View style={styles.patientActions}>
                <Button
                  title="Check In"
                  variant="primary"
                  size="small"
                  onPress={() => handleCheckIn(apt.id)}
                />
              </View>
            </Card>
          ))
        )}

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(nurse)/vitals')}>
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="pulse" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Record Vitals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(nurse)/medications')}>
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.successLight }]}>
              <Ionicons name="medical" size={24} color={Colors.success} />
            </View>
            <Text style={styles.quickActionText}>Medications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(nurse)/patients')}>
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.infoLight }]}>
              <Ionicons name="people" size={24} color={Colors.info} />
            </View>
            <Text style={styles.quickActionText}>All Patients</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: Typography.fontSize.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, color: Colors.textPrimary },
  headerSubtitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, alignItems: 'center' },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  statValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, color: Colors.textPrimary },
  statLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, marginTop: Spacing.md },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary },
  emptyCard: { alignItems: 'center', marginBottom: Spacing.md },
  emptyText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: Typography.fontSize.sm },
  patientCard: { marginBottom: Spacing.sm },
  patientHeader: { flexDirection: 'row', alignItems: 'center' },
  chairBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  chairNumber: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md, color: Colors.primary },
  timeBox: { backgroundColor: Colors.warningLight, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, marginRight: Spacing.md },
  timeText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm, color: Colors.warning },
  patientInfo: { flex: 1 },
  patientName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary },
  patientStatus: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary },
  patientActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  actionText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.primary },
  quickActionsRow: { flexDirection: 'row', gap: Spacing.md },
  quickAction: { flex: 1, alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, ...Shadows.small },
  quickActionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  quickActionText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.xs, color: Colors.textPrimary, textAlign: 'center' },
});
