/**
 * Doctor OPD Home - Dashboard with patient overview
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Card, Avatar, Badge, Button } from '../../src/components';
import { useAuthStore } from '../../src/store/authStore';

export default function DoctorOPDHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  // Mock data
  const stats = [
    { label: 'Today\'s Patients', value: 12, icon: 'people', color: Colors.primary },
    { label: 'Pending Reviews', value: 5, icon: 'clipboard', color: Colors.warning },
    { label: 'Active Protocols', value: 28, icon: 'document-text', color: Colors.success },
    { label: 'Day Care Referrals', value: 3, icon: 'arrow-forward-circle', color: Colors.info },
  ];

  const upcomingAppointments = [
    { id: '1', name: 'John Smith', time: '9:00 AM', type: 'Follow-up', avatar: null },
    { id: '2', name: 'Maria Garcia', time: '9:30 AM', type: 'Initial Consultation', avatar: null },
    { id: '3', name: 'Robert Johnson', time: '10:00 AM', type: 'Protocol Review', avatar: null },
  ];

  const pendingActions = [
    { id: '1', title: 'Review lab results for Sarah Wilson', priority: 'high', type: 'lab' },
    { id: '2', title: 'Approve treatment plan for Michael Brown', priority: 'medium', type: 'treatment' },
    { id: '3', title: 'Sign off on cycle completion for James Lee', priority: 'low', type: 'cycle' },
  ];

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
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>Dr. {user?.full_name?.split(' ')[1] || 'Doctor'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(doctor-opd)/profile')}>
            <Avatar source={user?.avatar ? { uri: user.avatar } : undefined} name={user?.full_name} size="medium" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
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

          {upcomingAppointments.map((appointment) => (
            <TouchableOpacity key={appointment.id} style={styles.appointmentItem}>
              <Avatar name={appointment.name} size="small" />
              <View style={styles.appointmentInfo}>
                <Text style={styles.appointmentName}>{appointment.name}</Text>
                <Text style={styles.appointmentType}>{appointment.type}</Text>
              </View>
              <View style={styles.appointmentTime}>
                <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.timeText}>{appointment.time}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Pending Actions */}
        <Card variant="default" padding="medium" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Actions</Text>
            <Badge label={`${pendingActions.length}`} variant="warning" size="small" />
          </View>

          {pendingActions.map((action) => (
            <TouchableOpacity key={action.id} style={styles.actionItem}>
              <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(action.priority) }]} />
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Badge 
                  label={action.priority.toUpperCase()} 
                  variant={action.priority === 'high' ? 'error' : action.priority === 'medium' ? 'warning' : 'success'} 
                  size="small" 
                />
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
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
            2 patients may need protocol adjustments based on recent lab results. Tap to review AI recommendations.
          </Text>
          <Button title="Review Insights" variant="primary" size="small" onPress={() => {}} />
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
});
