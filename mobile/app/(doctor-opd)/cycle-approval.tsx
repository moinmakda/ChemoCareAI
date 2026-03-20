/**
 * Cycle Approval Screen - Doctor reviews and approves individual treatment cycles
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
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Header, Card, Badge, Avatar } from '../../src/components';
import { treatmentService } from '../../src/services/treatmentService';
import { doctorService } from '../../src/services/doctorService';

interface PendingCycle {
  id: string;
  cycleNumber: number;
  scheduledDate: string;
  status: string;
  planId: string;
  protocolName: string;
  patientName: string;
  patientId: string;
  drugs: Array<{ drugName: string; calculatedDose?: number; calculatedDoseUnit?: string; route?: string }>;
}

export default function CycleApprovalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCycles, setPendingCycles] = useState<PendingCycle[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [plans, patients] = await Promise.all([
        treatmentService.listTreatmentPlans(),
        doctorService.getPatients({ limit: 200 }),
      ]);

      const patientMap: Record<string, string> = {};
      patients.forEach((p: any) => {
        patientMap[p.id] = `${p.firstName} ${p.lastName}`;
      });

      const pending: PendingCycle[] = [];

      for (const plan of plans) {
        if (plan.status !== 'active' && plan.status !== 'approved') continue;

        try {
          const cycles = await treatmentService.getCycles(plan.id);
          const scheduledCycles = cycles.filter((c: any) => c.status === 'scheduled');

          for (const cycle of scheduledCycles) {
            const protocol = (plan as any).customProtocol;
            const drugs = protocol?.chemotherapyDrugs || protocol?.drugs || [];

            pending.push({
              id: cycle.id,
              cycleNumber: cycle.cycleNumber,
              scheduledDate: cycle.scheduledDate,
              status: cycle.status,
              planId: plan.id,
              protocolName: (plan as any).protocolName || 'Unknown Protocol',
              patientName: patientMap[(plan as any).patientId] || 'Unknown Patient',
              patientId: (plan as any).patientId,
              drugs: drugs.map((d: any) => ({
                drugName: d.drugName || d.drug || d.name || 'Unknown',
                calculatedDose: d.calculatedDose,
                calculatedDoseUnit: d.calculatedDoseUnit || d.unit,
                route: d.route,
              })),
            });
          }
        } catch {
          // skip plans where cycles fail to load
        }
      }

      // Sort by scheduled date
      pending.sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
      setPendingCycles(pending);
    } catch {
      // silent
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

  const handleApprove = (cycle: PendingCycle) => {
    Alert.alert(
      'Approve Cycle',
      `Approve Cycle ${cycle.cycleNumber} for ${cycle.patientName}?\n\nThis will allow the nurse to begin treatment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setApprovingId(cycle.id);
            try {
              await treatmentService.approveCycle(cycle.id, notesMap[cycle.id]);
              Alert.alert('Approved', `Cycle ${cycle.cycleNumber} approved for ${cycle.patientName}`);
              await fetchData();
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.detail || 'Failed to approve cycle');
            } finally {
              setApprovingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Not scheduled';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr.startsWith(today);
  };

  const renderCycle = ({ item }: { item: PendingCycle }) => (
    <Card variant="default" padding="medium" style={styles.cycleCard}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.patientRow}>
          <Avatar name={item.patientName} size="small" />
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{item.patientName}</Text>
            <Text style={styles.protocolName}>{item.protocolName}</Text>
          </View>
        </View>
        <View style={styles.cycleBadge}>
          <Text style={styles.cycleBadgeText}>Cycle {item.cycleNumber}</Text>
        </View>
      </View>

      {/* Schedule */}
      <View style={styles.scheduleRow}>
        <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
        <Text style={[styles.scheduleDate, isToday(item.scheduledDate) && styles.todayDate]}>
          {formatDate(item.scheduledDate)}
          {isToday(item.scheduledDate) ? ' (Today)' : ''}
        </Text>
      </View>

      {/* Drugs */}
      <View style={styles.drugsSection}>
        <Text style={styles.drugsTitle}>Drugs</Text>
        {item.drugs.slice(0, 4).map((drug, idx) => (
          <View key={idx} style={styles.drugRow}>
            <View style={styles.drugDot} />
            <Text style={styles.drugText} numberOfLines={1}>
              {drug.drugName}
              {drug.calculatedDose ? ` — ${drug.calculatedDose} ${drug.calculatedDoseUnit || ''}` : ''}
              {drug.route ? ` (${drug.route})` : ''}
            </Text>
          </View>
        ))}
        {item.drugs.length > 4 && (
          <Text style={styles.moreDrugs}>+{item.drugs.length - 4} more</Text>
        )}
      </View>

      {/* Notes */}
      <TextInput
        style={styles.notesInput}
        placeholder="Approval notes (optional)"
        placeholderTextColor={Colors.textTertiary}
        value={notesMap[item.id] || ''}
        onChangeText={(text) => setNotesMap(prev => ({ ...prev, [item.id]: text }))}
        multiline
      />

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.viewPatientBtn}
          onPress={() => router.push({ pathname: '/(doctor-opd)/patient-detail' as any, params: { patientId: item.patientId } })}
        >
          <Ionicons name="person" size={16} color={Colors.primary} />
          <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm }}>View Patient</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => handleApprove(item)}
          disabled={approvingId === item.id}
          activeOpacity={0.7}
        >
          {approvingId === item.id ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
              <Text style={styles.approveText}>Approve Cycle</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading pending cycles...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Cycle Approval" showBackButton onBackPress={() => router.back()} />

      <FlatList
        data={pendingCycles}
        renderItem={renderCycle}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Pending Cycles</Text>
            <Text style={styles.emptyText}>
              All treatment cycles have been approved. New cycles will appear here when scheduled.
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
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  cycleCard: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  protocolName: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  cycleBadge: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  cycleBadgeText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  scheduleDate: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  todayDate: {
    color: Colors.success,
    fontFamily: Typography.fontFamily.semiBold,
  },
  drugsSection: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  drugsTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  drugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  drugDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  drugText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
  moreDrugs: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  notesInput: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  viewPatientBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
  },
  approveText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
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
    paddingHorizontal: Spacing.xl,
  },
});
