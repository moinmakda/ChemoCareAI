/**
 * Active Treatments Screen - Real-time monitoring of ongoing infusions
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Avatar, Badge, Card, Header } from '../../src/components';
import { doctorService, AppointmentAPI, PatientSummaryAPI } from '../../src/services/doctorService';

interface ActiveTreatment {
  id: string;
  appointment: AppointmentAPI;
  patient: PatientSummaryAPI | null;
  elapsedMins: number;
  progressPercent: number;
  drugName: string;
  infusionRate: string;
}

export default function ActiveTreatmentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [treatments, setTreatments] = useState<ActiveTreatment[]>([]);

  // Fetch active treatments
  const fetchData = useCallback(async () => {
    try {
      const [activeAppts, patients] = await Promise.all([
        doctorService.getActiveAppointments(),
        doctorService.getPatients({ limit: 100 }),
      ]);

      // Filter for in-progress treatments
      const inProgress = activeAppts.filter(a => 
        a.status === 'in_progress' || a.status === 'checked_in'
      );

      // Mock drug data - in production would come from treatment cycles API
      const drugOptions = ['Oxaliplatin', 'Paclitaxel', '5-Fluorouracil', 'Doxorubicin', 'Carboplatin'];
      
      const activeTreatments: ActiveTreatment[] = inProgress.map((apt, idx) => {
        const patient = patients.find(p => p.id === apt.patientId) || null;
        const checkedInTime = apt.checkedInAt ? new Date(apt.checkedInAt) : new Date();
        const elapsedMins = Math.floor((Date.now() - checkedInTime.getTime()) / 60000);
        const progressPercent = Math.min(100, Math.round((elapsedMins / apt.durationMins) * 100));
        
        return {
          id: apt.id,
          appointment: apt,
          patient,
          elapsedMins,
          progressPercent,
          drugName: drugOptions[idx % drugOptions.length],
          infusionRate: `${50 + idx * 10} ml/hr`,
        };
      });

      setTreatments(activeTreatments);
    } catch (error) {
      console.error('Error fetching active treatments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Handle treatment completion
  const completeTreatment = async (treatmentId: string) => {
    Alert.alert(
      'Complete Treatment',
      'Mark this infusion as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await doctorService.updateAppointmentStatus(treatmentId, 'completed');
              await fetchData();
              Alert.alert('Success', 'Treatment marked as completed');
            } catch (error) {
              Alert.alert('Error', 'Failed to update treatment status');
            }
          },
        },
      ]
    );
  };

  // Format elapsed time
  const formatElapsed = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get progress color
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return Colors.success;
    if (percent >= 50) return Colors.warning;
    return Colors.primary;
  };

  const renderTreatment = ({ item }: { item: ActiveTreatment }) => {
    const patientName = item.patient 
      ? `${item.patient.firstName} ${item.patient.lastName}`
      : 'Unknown Patient';
    
    return (
      <Card variant="default" padding="medium" style={styles.treatmentCard}>
        <View style={styles.cardHeader}>
          <View style={styles.patientInfo}>
            {item.appointment.chairNumber && (
              <View style={styles.chairBadge}>
                <Text style={styles.chairNumber}>{item.appointment.chairNumber}</Text>
              </View>
            )}
            <View>
              <Text style={styles.patientName}>{patientName}</Text>
              <Text style={styles.drugName}>{item.drugName}</Text>
            </View>
          </View>
          <Badge 
            label={item.appointment.status === 'in_progress' ? 'Infusing' : 'Ready'} 
            variant={item.appointment.status === 'in_progress' ? 'success' : 'info'} 
            size="small" 
          />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressPercent}>{item.progressPercent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${item.progressPercent}%`,
                  backgroundColor: getProgressColor(item.progressPercent),
                }
              ]} 
            />
          </View>
          <View style={styles.progressMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.metaText}>
                {formatElapsed(item.elapsedMins)} / {item.appointment.durationMins}m
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="water-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{item.infusionRate}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="pulse-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionText}>Vitals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionText}>Notes</Text>
          </TouchableOpacity>
          {item.progressPercent >= 90 && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => completeTreatment(item.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
              <Text style={[styles.actionText, { color: Colors.success }]}>Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading active treatments...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Active Treatments" />
      
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="bed-outline" size={24} color={Colors.primary} />
          <Text style={styles.statValue}>{treatments.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="pulse-outline" size={24} color={Colors.success} />
          <Text style={styles.statValue}>
            {treatments.filter(t => t.appointment.status === 'in_progress').length}
          </Text>
          <Text style={styles.statLabel}>Infusing</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="timer-outline" size={24} color={Colors.warning} />
          <Text style={styles.statValue}>
            {treatments.filter(t => t.progressPercent >= 90).length}
          </Text>
          <Text style={styles.statLabel}>Completing</Text>
        </View>
      </View>

      <FlatList
        data={treatments}
        renderItem={renderTreatment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="bed-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Active Treatments</Text>
            <Text style={styles.emptyText}>
              Treatments will appear here once patients are checked in
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  statItem: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.small,
  },
  statValue: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  statLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  treatmentCard: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chairBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chairNumber: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
  },
  patientName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  drugName: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  progressSection: {
    marginBottom: Spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  progressPercent: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  completeButton: {
    marginLeft: 'auto',
  },
  actionText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
