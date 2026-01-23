/**
 * Patient Home Screen - Dashboard with treatment overview
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/constants/theme';
import { Card, Avatar, Badge, Button } from '../../src/components';
import { useAuthStore } from '../../src/store/authStore';
import { usePatientStore } from '../../src/store/patientStore';
import { vitalsService, appointmentsService } from '../../src/services';
import type { Vital, Appointment, TreatmentPlan } from '../../src/types';

export default function PatientHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { currentPatient, isLoading, error, fetchCurrentPatient, treatmentPlans, fetchTreatmentPlans } = usePatientStore();

  const [refreshing, setRefreshing] = useState(false);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [latestVitals, setLatestVitals] = useState<Vital | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const loadDashboardData = async () => {
    try {
      await fetchCurrentPatient();
      setNeedsOnboarding(false);
    } catch (error: any) {
      // If 404, patient needs to complete onboarding
      if (error?.response?.status === 404 || error?.message?.includes('404')) {
        setNeedsOnboarding(true);
      } else {
        console.error('Error loading patient:', error);
      }
    } finally {
      setLoadingData(false);
    }
  };

  // Load additional data when patient is available
  useEffect(() => {
    const loadAdditionalData = async () => {
      if (!currentPatient) return;
      
      try {
        await fetchTreatmentPlans();
        
        // Load appointments for current patient
        const appointments = await appointmentsService.listAppointments();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingAppointments = appointments
          .filter(apt => new Date(apt.scheduledDate) >= today && apt.status !== 'cancelled')
          .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
        
        if (upcomingAppointments.length > 0) {
          setNextAppointment(upcomingAppointments[0]);
        }
        
        // Load latest vitals
        const vitals = await vitalsService.getLatestVitals(currentPatient.id);
        if (vitals) {
          setLatestVitals(vitals);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoadingData(false);
      }
    };
    
    loadAdditionalData();
  }, [currentPatient?.id]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Check if patient profile exists from error
  useEffect(() => {
    if (error?.includes('404') || error?.includes('not found')) {
      setNeedsOnboarding(true);
      setLoadingData(false);
    }
  }, [error]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Calculate treatment progress from active treatment plan
  const getActiveTreatmentProgress = () => {
    const activePlan = treatmentPlans?.find(p => p.status === 'active' || p.status === 'approved');
    if (activePlan) {
      const percentage = Math.round((activePlan.completedCycles / activePlan.plannedCycles) * 100);
      return {
        completed: activePlan.completedCycles,
        total: activePlan.plannedCycles,
        percentage,
        protocolName: activePlan.protocolName,
      };
    }
    return null;
  };

  const treatmentProgress = getActiveTreatmentProgress();

  // Format appointment date
  const formatAppointmentDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Format time
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Format appointment type for display
  const formatAppointmentType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // If patient needs to complete onboarding, show that screen
  if (needsOnboarding) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.onboardingPrompt}>
          <View style={styles.onboardingIcon}>
            <Ionicons name="person-add" size={64} color={colors.primary[500]} />
          </View>
          <Text style={styles.onboardingTitle}>Complete Your Profile</Text>
          <Text style={styles.onboardingSubtitle}>
            Before you can access your health dashboard, we need some information about you.
          </Text>
          <Button
            title="Get Started"
            variant="primary"
            size="large"
            onPress={() => router.push('/(patient)/onboarding')}
            style={styles.onboardingButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Morning,</Text>
          <Text style={styles.userName}>{user?.fullName || 'Patient'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(patient)/profile')}>
          <Avatar
            source={user?.avatar ? { uri: user.avatar } : undefined}
            name={user?.fullName}
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
        {/* Loading State */}
        {loadingData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text style={styles.loadingText}>Loading your dashboard...</Text>
          </View>
        ) : (
          <>
            {/* Next Appointment Card */}
            {nextAppointment ? (
              <Card variant="elevated" padding="large" style={styles.appointmentCard}>
                <View style={styles.appointmentHeader}>
                  <View style={styles.appointmentInfo}>
                    <Badge label="Upcoming" variant="primary" size="small" />
                    <Text style={styles.appointmentDate}>{formatAppointmentDate(nextAppointment.scheduledDate)}</Text>
                    <Text style={styles.appointmentTime}>{formatTime(nextAppointment.scheduledTime)}</Text>
                  </View>
                  <View style={styles.appointmentIcon}>
                    <Ionicons name="calendar" size={32} color={colors.primary[500]} />
                  </View>
                </View>

                <View style={styles.appointmentDetails}>
                  <Text style={styles.appointmentType}>{formatAppointmentType(nextAppointment.appointmentType)}</Text>
                  {nextAppointment.chairNumber && (
                    <Text style={styles.appointmentDoctor}>Chair #{nextAppointment.chairNumber}</Text>
                  )}
                  {nextAppointment.notes && (
                    <Text style={styles.appointmentCycle}>{nextAppointment.notes}</Text>
                  )}
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
            ) : (
              <Card variant="default" padding="large" style={styles.appointmentCard}>
                <View style={styles.noDataContainer}>
                  <Ionicons name="calendar-outline" size={48} color={colors.neutral[300]} />
                  <Text style={styles.noDataText}>No upcoming appointments</Text>
                  <Button
                    title="View Schedule"
                    variant="outline"
                    size="small"
                    onPress={() => router.push('/(patient)/schedule')}
                  />
                </View>
              </Card>
            )}

            {/* Treatment Progress */}
            <Card variant="default" padding="medium" style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Treatment Progress</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>See Details</Text>
                </TouchableOpacity>
              </View>

              {treatmentProgress ? (
                <View style={styles.progressContainer}>
                  <Text style={styles.protocolName}>{treatmentProgress.protocolName}</Text>
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
              ) : (
                <View style={styles.noDataContainerSmall}>
                  <Text style={styles.noDataTextSmall}>No active treatment plan</Text>
                </View>
              )}
            </Card>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(patient)/vitals')}>
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

              {latestVitals ? (
                <View style={styles.vitalsGrid}>
                  <View style={styles.vitalItem}>
                    <Ionicons name="thermometer-outline" size={20} color={colors.primary[500]} />
                    <Text style={styles.vitalValue}>
                      {latestVitals.temperatureF ? `${latestVitals.temperatureF}°F` : '--'}
                    </Text>
                    <Text style={styles.vitalLabel}>Temperature</Text>
                  </View>

                  <View style={styles.vitalItem}>
                    <Ionicons name="pulse-outline" size={20} color={colors.error} />
                    <Text style={styles.vitalValue}>
                      {latestVitals.bloodPressureSystolic && latestVitals.bloodPressureDiastolic
                        ? `${latestVitals.bloodPressureSystolic}/${latestVitals.bloodPressureDiastolic}`
                        : '--'}
                    </Text>
                    <Text style={styles.vitalLabel}>Blood Pressure</Text>
                  </View>

                  <View style={styles.vitalItem}>
                    <Ionicons name="heart-outline" size={20} color={colors.success} />
                    <Text style={styles.vitalValue}>
                      {latestVitals.pulseBpm ? `${latestVitals.pulseBpm} bpm` : '--'}
                    </Text>
                    <Text style={styles.vitalLabel}>Heart Rate</Text>
                  </View>

                  <View style={styles.vitalItem}>
                    <Ionicons name="scale-outline" size={20} color={colors.warning} />
                    <Text style={styles.vitalValue}>
                      {latestVitals.weightKg ? `${latestVitals.weightKg} kg` : '--'}
                    </Text>
                    <Text style={styles.vitalLabel}>Weight</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.noDataContainerSmall}>
                  <Text style={styles.noDataTextSmall}>No vitals recorded yet</Text>
                </View>
              )}
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
          </>
        )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  noDataText: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  noDataContainerSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  noDataTextSmall: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
  },
  protocolName: {
    fontSize: typography.callout.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  onboardingPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  onboardingIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  onboardingTitle: {
    fontSize: typography.title2.fontSize,
    fontWeight: typography.title2.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  onboardingSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  onboardingButton: {
    minWidth: 200,
  },
});
