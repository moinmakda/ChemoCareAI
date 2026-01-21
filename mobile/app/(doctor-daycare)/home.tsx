/**
 * Doctor Day Care Home - Real-time day care monitoring dashboard
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

interface ActivePatient {
  id: string;
  name: string;
  chair: number;
  protocol: string;
  drug: string;
  progress: number;
  startTime: string;
  estimatedEnd: string;
  status: 'infusing' | 'monitoring' | 'premedication' | 'completed' | 'alert';
  nurseAssigned: string;
  vitalsStatus: 'normal' | 'warning' | 'critical';
}

export default function DoctorDayCareHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  // Mock data - active patients in day care
  const activePatients: ActivePatient[] = [
    {
      id: '1',
      name: 'John Smith',
      chair: 1,
      protocol: 'FOLFOX',
      drug: 'Oxaliplatin',
      progress: 65,
      startTime: '08:30',
      estimatedEnd: '12:30',
      status: 'infusing',
      nurseAssigned: 'Sarah',
      vitalsStatus: 'normal',
    },
    {
      id: '2',
      name: 'Maria Garcia',
      chair: 3,
      protocol: 'R-CHOP',
      drug: 'Rituximab',
      progress: 30,
      startTime: '09:00',
      estimatedEnd: '14:00',
      status: 'monitoring',
      nurseAssigned: 'Emily',
      vitalsStatus: 'warning',
    },
    {
      id: '3',
      name: 'Robert Johnson',
      chair: 5,
      protocol: 'ABVD',
      drug: 'Doxorubicin',
      progress: 0,
      startTime: '09:30',
      estimatedEnd: '13:00',
      status: 'premedication',
      nurseAssigned: 'Michael',
      vitalsStatus: 'normal',
    },
    {
      id: '4',
      name: 'Lisa Chen',
      chair: 2,
      protocol: 'Paclitaxel',
      drug: 'Paclitaxel',
      progress: 45,
      startTime: '08:00',
      estimatedEnd: '11:00',
      status: 'alert',
      nurseAssigned: 'Sarah',
      vitalsStatus: 'critical',
    },
  ];

  const stats = {
    totalChairs: 12,
    occupied: 4,
    scheduled: 6,
    alerts: 1,
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const getStatusColor = (status: ActivePatient['status']) => {
    switch (status) {
      case 'infusing': return Colors.success;
      case 'monitoring': return Colors.info;
      case 'premedication': return Colors.warning;
      case 'completed': return Colors.textSecondary;
      case 'alert': return Colors.error;
    }
  };

  const getStatusLabel = (status: ActivePatient['status']) => {
    switch (status) {
      case 'infusing': return 'Infusing';
      case 'monitoring': return 'Monitoring';
      case 'premedication': return 'Pre-Med';
      case 'completed': return 'Completed';
      case 'alert': return 'ALERT';
    }
  };

  const getVitalsIcon = (status: ActivePatient['vitalsStatus']) => {
    switch (status) {
      case 'normal': return 'checkmark-circle';
      case 'warning': return 'warning';
      case 'critical': return 'alert-circle';
    }
  };

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
            <Ionicons name="notifications" size={24} color={Colors.error} />
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{stats.alerts}</Text>
            </View>
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
        {/* Overview Stats */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{stats.occupied}/{stats.totalChairs}</Text>
            <Text style={styles.overviewLabel}>Chairs Occupied</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{stats.scheduled}</Text>
            <Text style={styles.overviewLabel}>Scheduled Today</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, stats.alerts > 0 && styles.alertValue]}>
              {stats.alerts}
            </Text>
            <Text style={styles.overviewLabel}>Active Alerts</Text>
          </View>
        </View>

        {/* Alerts Section */}
        {stats.alerts > 0 && (
          <Card variant="outlined" padding="medium" style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Ionicons name="alert-circle" size={20} color={Colors.error} />
              <Text style={styles.alertTitle}>Active Alert</Text>
            </View>
            <Text style={styles.alertText}>
              Chair 2 - Lisa Chen: Possible reaction detected. Vital signs abnormal.
            </Text>
            <View style={styles.alertActions}>
              <Button title="View Details" variant="danger" size="small" onPress={() => {}} />
              <Button title="Acknowledge" variant="outline" size="small" onPress={() => {}} />
            </View>
          </Card>
        )}

        {/* Active Patients */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Patients</Text>
          <TouchableOpacity onPress={() => router.push('/(doctor-daycare)/active')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {activePatients.map((patient) => (
          <TouchableOpacity key={patient.id}>
            <Card
              variant={patient.status === 'alert' ? 'outlined' : 'default'}
              padding="medium"
              style={[
                styles.patientCard,
                patient.status === 'alert' ? styles.alertPatientCard : undefined,
              ]}
            >
              <View style={styles.patientHeader}>
                <View style={styles.chairBadge}>
                  <Text style={styles.chairNumber}>{patient.chair}</Text>
                </View>
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{patient.name}</Text>
                  <Text style={styles.patientProtocol}>{patient.protocol} - {patient.drug}</Text>
                </View>
                <Badge
                  label={getStatusLabel(patient.status)}
                  variant={
                    patient.status === 'alert' ? 'error' :
                    patient.status === 'infusing' ? 'success' :
                    patient.status === 'monitoring' ? 'info' : 'warning'
                  }
                  size="small"
                />
              </View>

              {/* Progress Bar */}
              {patient.status !== 'premedication' && (
                <View style={styles.progressSection}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${patient.progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{patient.progress}%</Text>
                </View>
              )}

              {/* Bottom Row */}
              <View style={styles.patientFooter}>
                <View style={styles.timeInfo}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.timeText}>{patient.startTime} - {patient.estimatedEnd}</Text>
                </View>
                <View style={styles.vitalsIndicator}>
                  <Ionicons
                    name={getVitalsIcon(patient.vitalsStatus) as any}
                    size={16}
                    color={
                      patient.vitalsStatus === 'normal' ? Colors.success :
                      patient.vitalsStatus === 'warning' ? Colors.warning : Colors.error
                    }
                  />
                  <Text style={styles.nurseText}>Nurse: {patient.nurseAssigned}</Text>
                </View>
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
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  alertButton: {
    position: 'relative',
  },
  alertBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 10,
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  overviewCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  overviewValue: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xxl,
    color: Colors.textPrimary,
  },
  overviewLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  alertValue: {
    color: Colors.error,
  },
  alertCard: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
    marginBottom: Spacing.lg,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  alertTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.error,
    marginLeft: Spacing.xs,
  },
  alertText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  alertActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
  patientCard: {
    marginBottom: Spacing.sm,
  },
  alertPatientCard: {
    borderColor: Colors.error,
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
  patientProtocol: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
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
  patientFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  vitalsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  nurseText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  aiCard: {
    marginTop: Spacing.lg,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  aiTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginLeft: Spacing.xs,
  },
  aiActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  aiActionButton: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  aiActionText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
