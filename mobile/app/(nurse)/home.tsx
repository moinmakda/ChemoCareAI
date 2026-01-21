/**
 * Nurse Home - Day care nursing dashboard
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Card, Avatar, Badge, Button } from '../../src/components';
import { useAuthStore } from '../../src/store/authStore';

interface AssignedPatient {
  id: string;
  name: string;
  chair: number;
  status: 'awaiting' | 'premedication' | 'infusing' | 'observation' | 'completed';
  currentTask: string;
  nextTask?: string;
  vitalsDue: boolean;
  medicationDue: boolean;
  progress: number;
}

export default function NurseHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  // Mock data
  const assignedPatients: AssignedPatient[] = [
    {
      id: '1',
      name: 'John Smith',
      chair: 1,
      status: 'infusing',
      currentTask: 'Monitoring infusion',
      nextTask: 'Vital signs check in 15 min',
      vitalsDue: false,
      medicationDue: false,
      progress: 65,
    },
    {
      id: '2',
      name: 'Lisa Chen',
      chair: 2,
      status: 'observation',
      currentTask: 'Post-infusion monitoring',
      vitalsDue: true,
      medicationDue: false,
      progress: 100,
    },
    {
      id: '3',
      name: 'Robert Johnson',
      chair: 5,
      status: 'premedication',
      currentTask: 'Administer pre-medications',
      nextTask: 'Start infusion at 10:30',
      vitalsDue: false,
      medicationDue: true,
      progress: 0,
    },
  ];

  const tasks = [
    { id: '1', title: 'Check vitals - Lisa Chen (Chair 2)', priority: 'high', type: 'vitals', time: 'Now' },
    { id: '2', title: 'Administer pre-med - Robert Johnson', priority: 'high', type: 'medication', time: 'Now' },
    { id: '3', title: 'Document infusion progress - John Smith', priority: 'medium', type: 'documentation', time: '10:15' },
    { id: '4', title: 'Prepare Chair 4 for new patient', priority: 'low', type: 'preparation', time: '10:30' },
  ];

  const stats = {
    assigned: 3,
    pendingVitals: 1,
    pendingMeds: 1,
    completed: 2,
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const getStatusColor = (status: AssignedPatient['status']) => {
    switch (status) {
      case 'awaiting': return Colors.textSecondary;
      case 'premedication': return Colors.warning;
      case 'infusing': return Colors.success;
      case 'observation': return Colors.info;
      case 'completed': return Colors.textTertiary;
    }
  };

  const getStatusLabel = (status: AssignedPatient['status']) => {
    switch (status) {
      case 'awaiting': return 'Awaiting';
      case 'premedication': return 'Pre-Med';
      case 'infusing': return 'Infusing';
      case 'observation': return 'Observation';
      case 'completed': return 'Completed';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return Colors.error;
      case 'medium': return Colors.warning;
      case 'low': return Colors.success;
      default: return Colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Morning,</Text>
          <Text style={styles.userName}>{user?.full_name || 'Nurse'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
          <Avatar source={user?.avatar ? { uri: user.avatar } : undefined} name={user?.full_name} size="medium" />
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
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Colors.primaryLight }]}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>{stats.assigned}</Text>
            <Text style={styles.statLabel}>Assigned</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.errorLight }]}>
            <Text style={[styles.statValue, { color: Colors.error }]}>{stats.pendingVitals}</Text>
            <Text style={styles.statLabel}>Vitals Due</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.warningLight }]}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{stats.pendingMeds}</Text>
            <Text style={styles.statLabel}>Meds Due</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(nurse)/vitals')}>
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.errorLight }]}>
              <Ionicons name="heart" size={24} color={Colors.error} />
            </View>
            <Text style={styles.quickActionText}>Record Vitals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(nurse)/medications')}>
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.warningLight }]}>
              <Ionicons name="medical" size={24} color={Colors.warning} />
            </View>
            <Text style={styles.quickActionText}>Give Medication</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.infoLight }]}>
              <Ionicons name="alert-circle" size={24} color={Colors.info} />
            </View>
            <Text style={styles.quickActionText}>Report Issue</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Tasks */}
        <Card variant="default" padding="medium" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Tasks</Text>
            <Badge label={`${tasks.length}`} variant="warning" size="small" />
          </View>

          {tasks.map((task) => (
            <TouchableOpacity key={task.id} style={styles.taskItem}>
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
              <View style={styles.taskContent}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskTime}>{task.time}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Assigned Patients */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Patients</Text>
          <TouchableOpacity onPress={() => router.push('/(nurse)/patients')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {assignedPatients.map((patient) => (
          <TouchableOpacity key={patient.id}>
            <Card variant="default" padding="medium" style={styles.patientCard}>
              <View style={styles.patientHeader}>
                <View style={styles.chairBadge}>
                  <Text style={styles.chairNumber}>{patient.chair}</Text>
                </View>
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{patient.name}</Text>
                  <Text style={styles.currentTask}>{patient.currentTask}</Text>
                </View>
                <Badge
                  label={getStatusLabel(patient.status)}
                  variant={
                    patient.status === 'infusing' ? 'success' :
                    patient.status === 'observation' ? 'info' :
                    patient.status === 'premedication' ? 'warning' : 'secondary'
                  }
                  size="small"
                />
              </View>

              {/* Alerts */}
              {(patient.vitalsDue || patient.medicationDue) && (
                <View style={styles.alertRow}>
                  {patient.vitalsDue && (
                    <View style={styles.alertItem}>
                      <Ionicons name="heart" size={14} color={Colors.error} />
                      <Text style={styles.alertText}>Vitals due</Text>
                    </View>
                  )}
                  {patient.medicationDue && (
                    <View style={styles.alertItem}>
                      <Ionicons name="medical" size={14} color={Colors.warning} />
                      <Text style={styles.alertText}>Medication due</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Progress */}
              {patient.status === 'infusing' && (
                <View style={styles.progressSection}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${patient.progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{patient.progress}%</Text>
                </View>
              )}

              {patient.nextTask && (
                <Text style={styles.nextTaskText}>Next: {patient.nextTask}</Text>
              )}
            </Card>
          </TouchableOpacity>
        ))}
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
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
  },
  statLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xxs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    ...Shadows.small,
  },
  quickActionText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
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
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  taskTime: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  patientCard: {
    marginBottom: Spacing.sm,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chairBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  chairNumber: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.primary,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  currentTask: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  alertRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  alertText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  progressText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    minWidth: 40,
    textAlign: 'right',
  },
  nextTaskText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});
