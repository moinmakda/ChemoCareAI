/**
 * Patient Home Screen - Dashboard with treatment overview
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/constants/theme';
import { Card, Avatar, Badge, Button } from '../../src/components';
import { useAuthStore } from '../../src/store/authStore';
import { usePatientStore } from '../../src/store/patientStore';

export default function PatientHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { currentPatient, isLoading, fetchCurrentPatient } = usePatientStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchCurrentPatient();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCurrentPatient();
    setRefreshing(false);
  };

  // Mock data for demonstration
  const nextAppointment = {
    date: 'Tomorrow',
    time: '10:00 AM',
    type: 'Chemotherapy Session',
    doctor: 'Dr. Sarah Johnson',
    cycle: 'Cycle 3 of 6',
  };

  const treatmentProgress = {
    completed: 2,
    total: 6,
    percentage: 33,
  };

  const recentVitals = {
    temperature: '37.2°C',
    bloodPressure: '120/80',
    heartRate: '72 bpm',
    weight: '68 kg',
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Morning,</Text>
          <Text style={styles.userName}>{user?.full_name || 'Patient'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(patient)/profile')}>
          <Avatar
            source={user?.avatar ? { uri: user.avatar } : undefined}
            name={user?.full_name}
            size="medium"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Next Appointment Card */}
        <Card variant="elevated" padding="large" style={styles.appointmentCard}>
          <View style={styles.appointmentHeader}>
            <View style={styles.appointmentInfo}>
              <Badge label="Upcoming" variant="primary" size="small" />
              <Text style={styles.appointmentDate}>{nextAppointment.date}</Text>
              <Text style={styles.appointmentTime}>{nextAppointment.time}</Text>
            </View>
            <View style={styles.appointmentIcon}>
              <Ionicons name="calendar" size={32} color={colors.primary[500]} />
            </View>
          </View>

          <View style={styles.appointmentDetails}>
            <Text style={styles.appointmentType}>{nextAppointment.type}</Text>
            <Text style={styles.appointmentDoctor}>{nextAppointment.doctor}</Text>
            <Text style={styles.appointmentCycle}>{nextAppointment.cycle}</Text>
          </View>

          <View style={styles.appointmentActions}>
            <Button
              title="View Details"
              variant="primary"
              size="small"
              onPress={() => router.push('/(patient)/schedule')}
            />
            <Button title="Reschedule" variant="outline" size="small" onPress={() => {}} />
          </View>
        </Card>

        {/* Treatment Progress */}
        <Card variant="default" padding="medium" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Treatment Progress</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${treatmentProgress.percentage}%` }]}
              />
            </View>
            <View style={styles.progressStats}>
              <Text style={styles.progressText}>
                {treatmentProgress.completed} of {treatmentProgress.total} cycles completed
              </Text>
              <Text style={styles.progressPercentage}>{treatmentProgress.percentage}%</Text>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="heart" size={24} color={colors.primary[500]} />
            </View>
            <Text style={styles.quickActionText}>Log Vitals</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="medical" size={24} color={colors.success} />
            </View>
            <Text style={styles.quickActionText}>Medications</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="alert-circle" size={24} color={colors.warning} />
            </View>
            <Text style={styles.quickActionText}>Side Effects</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(patient)/chat')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="chatbubble" size={24} color={colors.info} />
            </View>
            <Text style={styles.quickActionText}>Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Vitals */}
        <Card variant="default" padding="medium" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Vitals</Text>
            <TouchableOpacity onPress={() => router.push('/(patient)/vitals')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.vitalsGrid}>
            <View style={styles.vitalItem}>
              <Ionicons name="thermometer-outline" size={20} color={colors.primary[500]} />
              <Text style={styles.vitalValue}>{recentVitals.temperature}</Text>
              <Text style={styles.vitalLabel}>Temperature</Text>
            </View>

            <View style={styles.vitalItem}>
              <Ionicons name="pulse-outline" size={20} color={colors.error} />
              <Text style={styles.vitalValue}>{recentVitals.bloodPressure}</Text>
              <Text style={styles.vitalLabel}>Blood Pressure</Text>
            </View>

            <View style={styles.vitalItem}>
              <Ionicons name="heart-outline" size={20} color={colors.success} />
              <Text style={styles.vitalValue}>{recentVitals.heartRate}</Text>
              <Text style={styles.vitalLabel}>Heart Rate</Text>
            </View>

            <View style={styles.vitalItem}>
              <Ionicons name="scale-outline" size={20} color={colors.warning} />
              <Text style={styles.vitalValue}>{recentVitals.weight}</Text>
              <Text style={styles.vitalLabel}>Weight</Text>
            </View>
          </View>
        </Card>

        {/* Emergency Contact */}
        <Card variant="outlined" padding="medium" style={styles.emergencyCard}>
          <View style={styles.emergencyContent}>
            <Ionicons name="call" size={24} color={colors.error} />
            <View style={styles.emergencyText}>
              <Text style={styles.emergencyTitle}>Need Immediate Help?</Text>
              <Text style={styles.emergencySubtitle}>
                Contact your care team or emergency services
              </Text>
            </View>
          </View>
          <Button title="Emergency Call" variant="danger" size="small" onPress={() => {}} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  greeting: {
    fontSize: typography.callout.fontSize,
    color: colors.text.secondary,
  },
  userName: {
    fontSize: typography.title2.fontSize,
    fontWeight: typography.title2.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  appointmentCard: {
    marginBottom: spacing.lg,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  appointmentInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  appointmentIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentDate: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  appointmentTime: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  },
  appointmentDetails: {
    marginBottom: spacing.md,
  },
  appointmentType: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
  },
  appointmentDoctor: {
    fontSize: typography.callout.fontSize,
    color: colors.text.secondary,
    marginTop: 2,
  },
  appointmentCycle: {
    fontSize: typography.caption1.fontSize,
    color: colors.primary[500],
    marginTop: spacing.xs,
  },
  appointmentActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  seeAllText: {
    fontSize: typography.callout.fontSize,
    color: colors.primary[500],
  },
  progressContainer: {
    gap: spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
  },
  progressPercentage: {
    fontSize: typography.caption1.fontSize,
    fontWeight: '600',
    color: colors.primary[500],
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  quickAction: {
    alignItems: 'center',
    width: 72,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionText: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  vitalItem: {
    width: '47%',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  vitalValue: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  vitalLabel: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emergencyCard: {
    borderColor: colors.error,
    gap: spacing.md,
  },
  emergencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emergencyText: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: typography.callout.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emergencySubtitle: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
  },
});
