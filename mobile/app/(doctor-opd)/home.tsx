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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Card, Avatar, Badge, Button, PendingApprovalsCard } from '../../src/components';
import { useAuthStore } from '../../src/store/authStore';
import { doctorService, PatientSummaryAPI, AppointmentAPI, DashboardStats } from '../../src/services/doctorService';
import { treatmentService } from '../../src/services/treatmentService';

interface AppointmentWithPatient extends AppointmentAPI {
  patientName?: string;
}

function RecentCompletions({ router, patients }: { router: any; patients: Record<string, PatientSummaryAPI> }) {
  const [completedCycles, setCompletedCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const plans = await treatmentService.listTreatmentPlans();
        const completed: any[] = [];
        // Include ALL plans (active, approved, AND completed)
        for (const plan of plans) {
          try {
            const cycles = await treatmentService.getCycles(plan.id);
            const done = cycles
              .filter((c: any) => c.status === 'completed')
              .sort((a: any, b: any) => (b.completedAt || '').localeCompare(a.completedAt || ''));
            const pat = patients[plan.patientId];
            const patientName = pat ? `${pat.firstName} ${pat.lastName}` : 'Patient';
            for (const c of done.slice(0, 2)) {
              completed.push({
                cycleId: c.id,
                cycleNumber: c.cycleNumber,
                protocolName: (plan as any).protocolName || 'Unknown',
                patientName,
                completedAt: c.completedAt,
              });
            }
          } catch { /* skip */ }
        }
        completed.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
        setCompletedCycles(completed.slice(0, 5));
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [patients]);

  if (loading) {
    return <ActivityIndicator size="small" color={Colors.primary} />;
  }

  if (completedCycles.length === 0) {
    return <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>No completed cycles yet</Text>;
  }

  const formatTime = (d: string) => {
    try {
      const dt = new Date(d);
      const now = new Date();
      const diffH = Math.floor((now.getTime() - dt.getTime()) / 3600000);
      if (diffH < 1) return 'Just now';
      if (diffH < 24) return `${diffH}h ago`;
      const diffD = Math.floor(diffH / 24);
      if (diffD === 1) return 'Yesterday';
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  return (
    <View style={{ gap: 8 }}>
      {completedCycles.map((c) => (
        <TouchableOpacity
          key={c.cycleId}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.white,
            borderRadius: 10,
            padding: 12,
            gap: 10,
          }}
          onPress={() => router.push({
            pathname: '/(doctor-opd)/discharge-summary',
            params: { cycleId: c.cycleId },
          })}
          activeOpacity={0.7}
          accessibilityLabel={`View discharge summary for ${c.patientName} ${c.protocolName} Cycle ${c.cycleNumber}`}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Typography.fontFamily.semiBold, fontSize: 14, color: Colors.textPrimary }}>
              {c.patientName}
            </Text>
            <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 12, color: Colors.textSecondary }}>
              {c.protocolName} — Cycle {c.cycleNumber} · {formatTime(c.completedAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      ))}
    </View>
  );
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
  const [patientAlerts, setPatientAlerts] = useState<any[]>([]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [statsData, appointmentsData, patientsData, alertsData] = await Promise.all([
        doctorService.getDashboardStats(),
        doctorService.getTodayAppointments(),
        doctorService.getPatients({ limit: 100 }),
        doctorService.getPatientAlerts(10).catch(() => []),
      ]);

      setStats(statsData);
      setPatientAlerts(alertsData);

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
    } catch {
      // silent — dashboard shows zeros, user can pull-to-refresh
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
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => Alert.alert('Alerts', 'You have pending protocol approvals and upcoming appointments. Check the Protocol and Appointments tabs for details.')}
            activeOpacity={0.6}
            accessibilityLabel="View notifications"
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
            {stats.pendingAlerts > 0 && <View style={styles.notificationBadge} />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(doctor-opd)/profile')}
            activeOpacity={0.7}
            accessibilityLabel="View profile"
            accessibilityRole="button"
          >
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
            <TouchableOpacity key={index} style={styles.statCard} activeOpacity={0.8} accessibilityLabel={`${stat.label}: ${stat.value}`} accessibilityRole="button">
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <Ionicons name={stat.icon as any} size={24} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Patient Alerts */}
        {patientAlerts.length > 0 && (
          <Card variant="default" padding="medium" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.sectionTitle}>Patient Alerts</Text>
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{patientAlerts.length}</Text>
                </View>
              </View>
            </View>
            {patientAlerts.map((alert, index) => {
              const isUrgent = alert.data?.alertLevel === 'urgent';
              return (
                <TouchableOpacity
                  key={alert.id}
                  style={[
                    styles.alertItem,
                    { backgroundColor: isUrgent ? Colors.errorLight : Colors.warningLight },
                    index === patientAlerts.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (alert.data?.patientId) {
                      router.push({
                        pathname: '/(doctor-opd)/patient-detail' as any,
                        params: { patientId: alert.data.patientId },
                      });
                    }
                  }}
                >
                  <View style={[styles.alertIconContainer, { backgroundColor: isUrgent ? '#DC2626' : '#F59E0B' }]}>
                    <Ionicons name="warning" size={16} color={Colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                    <Text style={styles.alertBody} numberOfLines={2}>{alert.body}</Text>
                    <Text style={styles.alertTime}>
                      {alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </Card>
        )}

        {/* Pending Protocol Approvals */}
        <PendingApprovalsCard userRole="doctor" />

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            title="New Patient"
            variant="primary"
            icon={<Ionicons name="person-add" size={18} color={Colors.white} />}
            onPress={() => router.push('/(doctor-opd)/register-patient')}
            style={styles.quickActionButton}
          />
        </View>

        {/* Navigation Shortcuts (moved from tabs) */}
        <View style={styles.shortcutsRow}>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/(doctor-opd)/active')} activeOpacity={0.7} accessibilityLabel="Active treatments" accessibilityRole="button">
            <Ionicons name="pulse" size={22} color={Colors.success} />
            <Text style={styles.shortcutLabel}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/(doctor-opd)/appointments')} activeOpacity={0.7} accessibilityLabel="Appointments" accessibilityRole="button">
            <Ionicons name="calendar" size={22} color={Colors.warning} />
            <Text style={styles.shortcutLabel}>Appointments</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/(doctor-opd)/protocols')} activeOpacity={0.7} accessibilityLabel="Protocols library" accessibilityRole="button">
            <Ionicons name="document-text" size={22} color={Colors.primary} />
            <Text style={styles.shortcutLabel}>Protocols</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Discharge Summaries */}
        <Card variant="filled" padding="medium" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Completions</Text>
          </View>
          <RecentCompletions router={router} patients={patients} />
        </Card>

        {/* Today's Appointments */}
        <Card variant="default" padding="medium" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Appointments</Text>
            <TouchableOpacity
              onPress={() => router.push('/(doctor-opd)/appointments')}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {upcomingAppointments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No appointments today</Text>
              <Text style={styles.emptySubtext}>Your schedule is clear. New appointments will appear here.</Text>
            </View>
          ) : (
            upcomingAppointments.map((appointment, index) => (
              <TouchableOpacity
                key={appointment.id}
                style={[
                  styles.appointmentItem,
                  index === upcomingAppointments.length - 1 && styles.appointmentItemLast,
                ]}
                onPress={() => router.push({ pathname: '/(doctor-opd)/patient-detail' as any, params: { patientId: appointment.patientId } })}
                activeOpacity={0.6}
              >
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

        {/* Clinical Notes Quick Action */}
        <Card variant="default" padding="medium" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Clinical Notes</Text>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}
            onPress={() => router.push('/(doctor-opd)/patients')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: Colors.portal.doctorDayCareBg }]}>
              <Ionicons name="document-text" size={24} color={Colors.portal.doctorDayCare} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary }}>
                View & Add Notes
              </Text>
              <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary }}>
                Select a patient to view or add clinical notes
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
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
            Generate AI-powered chemotherapy protocol recommendations based on patient clinical data.
          </Text>
          <Button title="Open Protocol Generator" variant="primary" size="small" onPress={() => router.push('/(doctor-opd)/protocols')} />
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
  shortcutsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  shortcutCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    ...Shadows.small,
  },
  shortcutLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
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
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 56,
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
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  emptySubtext: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  appointmentItemLast: {
    borderBottomWidth: 0,
  },
  alertBadge: {
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 6,
  },
  alertBadgeText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
  },
  alertItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  alertIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  alertTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  alertBody: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  alertTime: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
