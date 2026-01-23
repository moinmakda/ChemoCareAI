/**
 * Doctor OPD Home - Dashboard with patient overview
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
import { doctorService, PatientSummaryAPI, AppointmentAPI, DashboardStats } from '../../src/services/doctorService';

interface AppointmentWithPatient extends AppointmentAPI {
  patientName?: string;
}

export default function DoctorOPDHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    todayAppointments: 0,
    activeTreatments: 0,
    pendingAlerts: 0,
  });
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentWithPatient[]>([]);
  const [patients, setPatients] = useState<Record<string, PatientSummaryAPI>>({});

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [statsData, appointmentsData, patientsData] = await Promise.all([
        doctorService.getDashboardStats(),
        doctorService.getTodayAppointments(),
        doctorService.getPatients({ limit: 100 }),
      ]);

      setStats(statsData);

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
      }));

      // Sort by scheduled time and take first 5
      appointmentsWithNames.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
      setUpcomingAppointments(appointmentsWithNames.slice(0, 5));
    } catch (error) {
      console.error('Error fetching OPD dashboard data:', error);
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

  // Format time from 24h to 12h format
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Get appointment type display name
  const getAppointmentTypeLabel = (type: string) => {
    switch (type) {
      case 'opd_consultation': return 'OPD Consultation';
      case 'follow_up': return 'Follow-up';
      case 'chemotherapy': return 'Chemotherapy';
      case 'lab_work': return 'Lab Work';
      default: return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  // Stats display config
  const statsDisplay = [
    { label: 'Total Patients', value: stats.totalPatients, icon: 'people', color: Colors.primary },
    { label: 'Today\'s Appointments', value: stats.todayAppointments, icon: 'calendar', color: Colors.warning },
    { label: 'Active Treatments', value: stats.activeTreatments, icon: 'medical', color: Colors.success },
    { label: 'Pending Alerts', value: stats.pendingAlerts, icon: 'alert-circle', color: Colors.error },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return Colors.error;
      case 'medium': return Colors.warning;
      case 'low': return Colors.success;
      default: return Colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
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
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>Dr. {user?.fullName?.split(' ')[1] || 'Doctor'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(doctor-opd)/profile')}>
            <Avatar source={user?.avatar ? { uri: user.avatar } : undefined} name={user?.fullName} size="medium" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {statsDisplay.map((stat, index) => (
            <TouchableOpacity key={index} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <Ionicons name={stat.icon as any} size={24} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            title="New Patient"
            variant="primary"
            icon={<Ionicons name="person-add" size={18} color={Colors.white} />}
            onPress={() => {}}
            style={styles.quickActionButton}
          />
          <Button
            title="AI Protocol"
            variant="outline"
            icon={<Ionicons name="sparkles" size={18} color={Colors.primary} />}
            onPress={() => {}}
            style={styles.quickActionButton}
          />
        </View>

        {/* Today's Appointments */}
        <Card variant="default" padding="medium" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Appointments</Text>
            <TouchableOpacity onPress={() => router.push('/(doctor-opd)/appointments')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {upcomingAppointments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No appointments today</Text>
            </View>
          ) : (
            upcomingAppointments.map((appointment) => (
              <TouchableOpacity key={appointment.id} style={styles.appointmentItem}>
                <Avatar name={appointment.patientName || 'Unknown'} size="small" />
                <View style={styles.appointmentInfo}>
                  <Text style={styles.appointmentName}>{appointment.patientName}</Text>
                  <Text style={styles.appointmentType}>{getAppointmentTypeLabel(appointment.appointmentType)}</Text>
                </View>
                <View style={styles.appointmentTime}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.timeText}>{formatTime(appointment.scheduledTime)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* AI Insights */}
        <Card variant="filled" padding="medium" style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.aiTitle}>AI Insights</Text>
          </View>
          <Text style={styles.aiText}>
            AI-powered protocol recommendations and patient insights coming soon.
          </Text>
          <Button title="View AI Chat" variant="primary" size="small" onPress={() => {}} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  greeting: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  userName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerButton: {
    position: 'relative',
    padding: Spacing.xs,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.small,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xxl,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickActionButton: {
    flex: 1,
  },
  sectionCard: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  seeAllText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  appointmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  appointmentInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  appointmentName: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  appointmentType: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  appointmentTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  priorityIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  actionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: Spacing.sm,
  },
  actionTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  aiCard: {
    marginBottom: Spacing.lg,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  aiTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  aiText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
});
