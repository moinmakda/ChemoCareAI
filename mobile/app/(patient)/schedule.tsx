/**
 * Patient Schedule Screen - Appointments and treatment calendar
 * Uses real API data for appointments
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Badge, Header } from '../../src/components';
import { appointmentsService } from '../../src/services/appointmentsService';

// API response type (converted to camelCase by API interceptor)
interface AppointmentAPI {
  id: string;
  patientId: string;
  appointmentType: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMins: number;
  cycleId?: string;
  chairNumber?: number;
  doctorId?: string;
  nurseId?: string;
  status: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PatientScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'past'>('upcoming');
  const [appointments, setAppointments] = useState<AppointmentAPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAppointments = async () => {
    try {
      const data = await appointmentsService.listAppointments();
      setAppointments(data as any);
    } catch (error: any) {
      console.error('Error loading appointments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  }, []);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const upcomingAppointments = appointments.filter((a) => {
    const apptDate = new Date(a.scheduledDate);
    return apptDate >= now && a.status !== 'cancelled' && a.status !== 'completed';
  });
  
  const pastAppointments = appointments.filter((a) => {
    const apptDate = new Date(a.scheduledDate);
    return apptDate < now || a.status === 'completed';
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'daycare_chemo': return 'medical';
      case 'opd_consultation': return 'person';
      case 'lab_work': return 'flask';
      case 'follow_up': return 'clipboard';
      case 'imaging': return 'scan';
      default: return 'calendar';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'daycare_chemo': return colors.primary[500];
      case 'opd_consultation': return colors.success;
      case 'lab_work': return colors.warning;
      case 'follow_up': return colors.info;
      case 'imaging': return colors.info;
      default: return colors.text.secondary;
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'daycare_chemo': return 'Chemotherapy Session';
      case 'opd_consultation': return 'OPD Consultation';
      case 'lab_work': return 'Lab Work';
      case 'follow_up': return 'Follow Up';
      case 'imaging': return 'Imaging/Scan';
      default: return 'Appointment';
    }
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
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return hour12 + ':' + minutes + ' ' + ampm;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled': return <Badge label="Scheduled" variant="info" size="small" />;
      case 'confirmed': return <Badge label="Confirmed" variant="primary" size="small" />;
      case 'checked_in': return <Badge label="Checked In" variant="success" size="small" />;
      case 'in_progress': return <Badge label="In Progress" variant="warning" size="small" />;
      case 'completed': return <Badge label="Completed" variant="success" size="small" />;
      case 'cancelled': return <Badge label="Cancelled" variant="error" size="small" />;
      default: return null;
    }
  };

  const renderAppointment = (appointment: AppointmentAPI) => (
    <Card key={appointment.id} variant="default" padding="medium" style={styles.appointmentCard}>
      <View style={styles.appointmentRow}>
        <View style={[styles.typeIcon, { backgroundColor: getTypeColor(appointment.appointmentType) + '15' }]}>
          <Ionicons name={getTypeIcon(appointment.appointmentType) as any} size={20} color={getTypeColor(appointment.appointmentType)} />
        </View>

        <View style={styles.appointmentContent}>
          <View style={styles.appointmentHeader}>
            <Text style={styles.appointmentTitle} numberOfLines={1}>
              {getTypeLabel(appointment.appointmentType)}
            </Text>
            {getStatusBadge(appointment.status)}
          </View>

          <View style={styles.appointmentMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.metaText}>{formatTime(appointment.scheduledTime)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="hourglass-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.metaText}>{appointment.durationMins} mins</Text>
            </View>
            {appointment.chairNumber && (
              <View style={styles.metaItem}>
                <Ionicons name="bed-outline" size={14} color={colors.text.secondary} />
                <Text style={styles.metaText}>Chair {appointment.chairNumber}</Text>
              </View>
            )}
          </View>

          {appointment.notes && (
            <Text style={styles.notesText} numberOfLines={2}>{appointment.notes}</Text>
          )}
        </View>
      </View>

      {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
        <View style={styles.appointmentActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
            <Text style={styles.actionText}>Reschedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="call-outline" size={18} color={colors.primary[500]} />
            <Text style={styles.actionText}>Contact</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );

  const groupByDate = (apps: AppointmentAPI[]) => {
    const groups: { [key: string]: AppointmentAPI[] } = {};
    apps.forEach((app) => {
      const dateKey = formatDate(app.scheduledDate);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(app);
    });
    return groups;
  };

  const currentAppointments = selectedTab === 'upcoming' ? upcomingAppointments : pastAppointments;
  const groupedAppointments = groupByDate(currentAppointments);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Schedule" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading appointments...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Schedule" />
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'upcoming' && styles.tabActive]}
          onPress={() => setSelectedTab('upcoming')}
        >
          <Text style={[styles.tabText, selectedTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcomingAppointments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'past' && styles.tabActive]}
          onPress={() => setSelectedTab('past')}
        >
          <Text style={[styles.tabText, selectedTab === 'past' && styles.tabTextActive]}>
            Past ({pastAppointments.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {Object.entries(groupedAppointments).map(([date, apps]) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={styles.dateHeader}>{date}</Text>
            {apps.map(renderAppointment)}
          </View>
        ))}

        {currentAppointments.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No Appointments</Text>
            <Text style={styles.emptyText}>
              {selectedTab === 'upcoming'
                ? 'You have no upcoming appointments scheduled.'
                : 'You have no past appointments to display.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.text.secondary, fontSize: typography.body.fontSize },
  tabContainer: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md, backgroundColor: colors.background.secondary },
  tabActive: { backgroundColor: colors.primary[500] },
  tabText: { fontWeight: '500', fontSize: typography.caption1.fontSize, color: colors.text.secondary },
  tabTextActive: { color: colors.neutral[0] },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  dateGroup: { marginTop: spacing.md },
  dateHeader: { fontWeight: '600', fontSize: typography.caption1.fontSize, color: colors.text.secondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  appointmentCard: { marginBottom: spacing.sm },
  appointmentRow: { flexDirection: 'row' },
  typeIcon: { width: 40, height: 40, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  appointmentContent: { flex: 1 },
  appointmentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs, gap: spacing.xs },
  appointmentTitle: { fontWeight: '600', fontSize: typography.body.fontSize, color: colors.text.primary, flex: 1 },
  appointmentMeta: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontWeight: '400', fontSize: 12, color: colors.text.secondary },
  notesText: { marginTop: spacing.xs, fontSize: typography.caption1.fontSize, color: colors.text.tertiary, fontStyle: 'italic' },
  appointmentActions: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.light, gap: spacing.lg },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { fontWeight: '500', fontSize: typography.caption1.fontSize, color: colors.primary[500] },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxxl },
  emptyTitle: { fontWeight: '600', fontSize: typography.title3.fontSize, color: colors.text.primary, marginTop: spacing.md },
  emptyText: { fontWeight: '400', fontSize: typography.caption1.fontSize, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xl },
});
