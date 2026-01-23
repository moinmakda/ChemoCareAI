/**
 * Doctor Day Care Home - Real-time day care monitoring dashboard
 * Uses real API data
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
import { doctorService, type PatientSummaryAPI, type AppointmentAPI, type DashboardStats } from '../../src/services/doctorService';

export default function DoctorDayCareHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    todayAppointments: 0,
    activeTreatments: 0,
    pendingAlerts: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<AppointmentAPI[]>([]);
  const [patients, setPatients] = useState<PatientSummaryAPI[]>([]);

  const loadData = async () => {
    try {
      const [dashStats, appts, patientList] = await Promise.all([
        doctorService.getDashboardStats(),
        doctorService.getTodayAppointments(),
        doctorService.getPatients({ limit: 50 }),
      ]);
      setStats(dashStats);
      setTodayAppointments(appts);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return Colors.success;
      case 'checked_in': return Colors.info;
      case 'scheduled': case 'confirmed': return Colors.warning;
      case 'completed': return Colors.textSecondary;
      case 'cancelled': return Colors.error;
      default: return Colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'checked_in': return 'Checked In';
      case 'scheduled': return 'Scheduled';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
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

  const getAppointmentTypeLabel = (type: string) => {
    switch (type) {
      case 'daycare_chemo': return 'Chemotherapy';
      case 'opd_consultation': return 'OPD';
      case 'follow_up': return 'Follow Up';
      case 'lab_work': return 'Lab Work';
      default: return type;
    }
  };

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      return patient.firstName + ' ' + patient.lastName;
    }
    return 'Unknown Patient';
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
          <Text style={styles.headerTitle}>Day Care Unit</Text>
          <Text style={styles.headerSubtitle}>Real-time Monitoring</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.alertButton}>
            <Ionicons name="notifications" size={24} color={stats.pendingAlerts > 0 ? Colors.error : Colors.textSecondary} />
            {stats.pendingAlerts > 0 && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{stats.pendingAlerts}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Avatar source={user?.avatar ? { uri: user.avatar } : undefined} name={user?.fullName} size="medium" />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Overview Stats */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{stats.activeTreatments}</Text>
            <Text style={styles.overviewLabel}>Active Now</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{stats.todayAppointments}</Text>
            <Text style={styles.overviewLabel}>Today</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{stats.totalPatients}</Text>
            <Text style={styles.overviewLabel}>Total Patients</Text>
          </View>
        </View>

        {/* Today's Appointments */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Appointments</Text>
          <TouchableOpacity onPress={() => router.push('/(doctor-daycare)/active')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {todayAppointments.length === 0 ? (
          <Card variant="default" padding="large" style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No appointments scheduled for today</Text>
          </Card>
        ) : (
          todayAppointments.slice(0, 5).map((apt) => (
            <TouchableOpacity key={apt.id}>
              <Card variant="default" padding="medium" style={styles.appointmentCard}>
                <View style={styles.appointmentHeader}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeText}>{formatTime(apt.scheduledTime)}</Text>
                  </View>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.patientName}>{getPatientName(apt.patientId)}</Text>
                    <Text style={styles.appointmentType}>{getAppointmentTypeLabel(apt.appointmentType)}</Text>
                  </View>
                  <Badge
                    label={getStatusLabel(apt.status)}
                    variant={
                      apt.status === 'in_progress' ? 'success' :
                      apt.status === 'checked_in' ? 'info' :
                      apt.status === 'completed' ? 'neutral' : 'warning'
                    }
                    size="small"
                  />
                </View>
                {apt.chairNumber && (
                  <View style={styles.appointmentFooter}>
                    <Ionicons name="bed-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.chairText}>Chair {apt.chairNumber}</Text>
                    <Text style={styles.durationText}>{apt.durationMins} mins</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* Patients Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Patients</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {patients.slice(0, 4).map((patient) => (
          <TouchableOpacity key={patient.id}>
            <Card variant="default" padding="medium" style={styles.patientCard}>
              <View style={styles.patientRow}>
                <Avatar name={patient.firstName + ' ' + patient.lastName} size="medium" />
                <View style={styles.patientInfo}>
                  <Text style={styles.patientNameText}>{patient.firstName} {patient.lastName}</Text>
                  <Text style={styles.patientDetails}>
                    {patient.cancerType || 'Cancer type not specified'}
                    {patient.cancerStage ? ' • Stage ' + patient.cancerStage : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        {/* AI Quick Actions */}
        <Card variant="filled" padding="medium" style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Ionicons name="sparkles" size={20} color={Colors.primary} />
            <Text style={styles.aiTitle}>AI Assistant</Text>
          </View>
          <View style={styles.aiActions}>
            <TouchableOpacity style={styles.aiActionButton}>
              <Ionicons name="calculator" size={20} color={Colors.primary} />
              <Text style={styles.aiActionText}>Dose Calculator</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aiActionButton}>
              <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
              <Text style={styles.aiActionText}>Drug Interactions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aiActionButton}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
              <Text style={styles.aiActionText}>Risk Assessment</Text>
            </TouchableOpacity>
          </View>
        </Card>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  alertButton: { position: 'relative' },
  alertBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  alertBadgeText: { fontFamily: Typography.fontFamily.bold, fontSize: 10, color: Colors.white },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  overviewCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.small },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewDivider: { width: 1, backgroundColor: Colors.border },
  overviewValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xxl, color: Colors.textPrimary },
  overviewLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, marginTop: Spacing.lg },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary },
  seeAllText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.primary },
  emptyCard: { alignItems: 'center', marginBottom: Spacing.md },
  emptyText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: Typography.fontSize.sm },
  appointmentCard: { marginBottom: Spacing.sm },
  appointmentHeader: { flexDirection: 'row', alignItems: 'center' },
  timeBox: { backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, marginRight: Spacing.md },
  timeText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm, color: Colors.primary },
  appointmentInfo: { flex: 1 },
  patientName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary },
  appointmentType: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary },
  appointmentFooter: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.xs },
  chairText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary },
  durationText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginLeft: 'auto' },
  patientCard: { marginBottom: Spacing.sm },
  patientRow: { flexDirection: 'row', alignItems: 'center' },
  patientInfo: { flex: 1, marginLeft: Spacing.md },
  patientNameText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary },
  patientDetails: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary },
  aiCard: { marginTop: Spacing.lg },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  aiTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary, marginLeft: Spacing.xs },
  aiActions: { flexDirection: 'row', justifyContent: 'space-around' },
  aiActionButton: { alignItems: 'center', padding: Spacing.md },
  aiActionText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' },
});
