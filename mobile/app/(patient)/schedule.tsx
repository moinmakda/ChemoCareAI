/**
 * Patient Schedule Screen - Appointments and treatment calendar
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Badge, Header } from '../../src/components';

interface Appointment {
  id: string;
  date: string;
  time: string;
  type: 'chemotherapy' | 'consultation' | 'lab' | 'followup';
  title: string;
  doctor: string;
  location: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  cycle?: string;
}

export default function PatientScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'past'>('upcoming');

  // Mock data
  const appointments: Appointment[] = [
    {
      id: '1',
      date: '2024-01-15',
      time: '10:00 AM',
      type: 'chemotherapy',
      title: 'Chemotherapy Session',
      doctor: 'Dr. Sarah Johnson',
      location: 'Day Care Unit - Room 3',
      status: 'upcoming',
      cycle: 'Cycle 3 of 6',
    },
    {
      id: '2',
      date: '2024-01-18',
      time: '2:30 PM',
      type: 'lab',
      title: 'Blood Work',
      doctor: 'Lab Department',
      location: 'Laboratory - 2nd Floor',
      status: 'upcoming',
    },
    {
      id: '3',
      date: '2024-01-22',
      time: '11:00 AM',
      type: 'consultation',
      title: 'Follow-up Consultation',
      doctor: 'Dr. Sarah Johnson',
      location: 'Oncology Clinic - Room 5',
      status: 'upcoming',
    },
    {
      id: '4',
      date: '2024-01-08',
      time: '10:00 AM',
      type: 'chemotherapy',
      title: 'Chemotherapy Session',
      doctor: 'Dr. Sarah Johnson',
      location: 'Day Care Unit - Room 3',
      status: 'completed',
      cycle: 'Cycle 2 of 6',
    },
  ];

  const upcomingAppointments = appointments.filter((a) => a.status === 'upcoming');
  const pastAppointments = appointments.filter((a) => a.status === 'completed');

  const getTypeIcon = (type: Appointment['type']) => {
    switch (type) {
      case 'chemotherapy':
        return 'medical';
      case 'consultation':
        return 'person';
      case 'lab':
        return 'flask';
      case 'followup':
        return 'clipboard';
      default:
        return 'calendar';
    }
  };

  const getTypeColor = (type: Appointment['type']): string => {
    switch (type) {
      case 'chemotherapy':
        return colors.primary[500];
      case 'consultation':
        return colors.success;
      case 'lab':
        return colors.warning;
      case 'followup':
        return colors.info;
      default:
        return colors.text.secondary;
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

  const renderAppointment = (appointment: Appointment) => (
    <Card
      key={appointment.id}
      variant="default"
      padding="medium"
      style={styles.appointmentCard}
    >
      <View style={styles.appointmentRow}>
        <View
          style={[
            styles.typeIcon,
            { backgroundColor: `${getTypeColor(appointment.type)}15` },
          ]}
        >
          <Ionicons
            name={getTypeIcon(appointment.type) as any}
            size={20}
            color={getTypeColor(appointment.type)}
          />
        </View>

        <View style={styles.appointmentContent}>
          <View style={styles.appointmentHeader}>
            <Text style={styles.appointmentTitle}>{appointment.title}</Text>
            {appointment.cycle && (
              <Badge label={appointment.cycle} variant="primary" size="small" />
            )}
          </View>

          <Text style={styles.appointmentDoctor}>{appointment.doctor}</Text>

          <View style={styles.appointmentMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.metaText}>{appointment.time}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.metaText}>{appointment.location}</Text>
            </View>
          </View>
        </View>
      </View>

      {appointment.status === 'upcoming' && (
        <View style={styles.appointmentActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
            <Text style={styles.actionText}>Reschedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="navigate-outline" size={18} color={colors.primary[500]} />
            <Text style={styles.actionText}>Directions</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );

  const groupByDate = (apps: Appointment[]) => {
    const groups: { [key: string]: Appointment[] } = {};
    apps.forEach((app) => {
      const dateKey = formatDate(app.date);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(app);
    });
    return groups;
  };

  const currentAppointments = selectedTab === 'upcoming' ? upcomingAppointments : pastAppointments;
  const groupedAppointments = groupByDate(currentAppointments);

  return (
    <View style={styles.container}>
      <Header title="Schedule" />

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'upcoming' && styles.tabActive]}
          onPress={() => setSelectedTab('upcoming')}
        >
          <Text
            style={[styles.tabText, selectedTab === 'upcoming' && styles.tabTextActive]}
          >
            Upcoming ({upcomingAppointments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'past' && styles.tabActive]}
          onPress={() => setSelectedTab('past')}
        >
          <Text
            style={[styles.tabText, selectedTab === 'past' && styles.tabTextActive]}
          >
            Past ({pastAppointments.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  tabActive: {
    backgroundColor: colors.primary[500],
  },
  tabText: {
    fontWeight: '500',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.neutral[0],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  dateGroup: {
    marginTop: spacing.md,
  },
  dateHeader: {
    fontWeight: '600',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  appointmentCard: {
    marginBottom: spacing.sm,
  },
  appointmentRow: {
    flexDirection: 'row',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  appointmentContent: {
    flex: 1,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  appointmentTitle: {
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    flex: 1,
  },
  appointmentDoctor: {
    fontWeight: '400',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  appointmentMeta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontWeight: '400',
    fontSize: 12,
    color: colors.text.secondary,
  },
  appointmentActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    fontWeight: '500',
    fontSize: typography.caption1.fontSize,
    color: colors.primary[500],
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
  },
  emptyTitle: {
    fontWeight: '600',
    fontSize: typography.title3.fontSize,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontWeight: '400',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
});
