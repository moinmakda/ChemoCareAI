/**
 * Nurse Discharge Summaries — List all completed cycles with discharge summaries
 * Tap any to view full summary with PDF/share options
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Header, Card, Badge, Avatar } from '../../src/components';
import { treatmentService } from '../../src/services/treatmentService';
import { doctorService } from '../../src/services/doctorService';

// If opened with cycleId param, show that specific summary (re-export behavior)
import DischargeSummaryDetail from '../(doctor-opd)/discharge-summary';

interface CompletedCycle {
  id: string;
  cycleNumber: number;
  completedAt: string;
  planId: string;
  protocolName: string;
  patientName: string;
  patientId: string;
  status: string;
}

export default function NurseDischargeSummariesScreen() {
  const router = useRouter();
  const { cycleId } = useLocalSearchParams<{ cycleId?: string }>();

  // If opened with a specific cycleId, show the detail screen directly
  if (cycleId) {
    return <DischargeSummaryDetail />;
  }

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completedCycles, setCompletedCycles] = useState<CompletedCycle[]>([]);
  const [patients, setPatients] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      const [plans, patientList] = await Promise.all([
        treatmentService.listTreatmentPlans(),
        doctorService.getPatients({ limit: 200 }),
      ]);

      // Build patient name lookup
      const patMap: Record<string, string> = {};
      patientList.forEach((p: any) => {
        patMap[p.id] = `${p.firstName} ${p.lastName}`;
      });
      setPatients(patMap);

      // Collect all completed cycles
      const completed: CompletedCycle[] = [];
      for (const plan of plans) {
        try {
          const cycles = await treatmentService.getCycles(plan.id);
          for (const cycle of cycles) {
            if (cycle.status === 'completed' && cycle.completedAt) {
              completed.push({
                id: cycle.id,
                cycleNumber: cycle.cycleNumber,
                completedAt: cycle.completedAt,
                planId: plan.id,
                protocolName: plan.protocolName || 'Treatment',
                patientName: patMap[plan.patientId] || 'Patient',
                patientId: plan.patientId,
                status: cycle.status,
              });
            }
          }
        } catch {
          // skip failed plan
        }
      }

      // Sort newest first
      completed.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      setCompletedCycles(completed);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  const renderItem = ({ item }: { item: CompletedCycle }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/(nurse)/discharge-summary', params: { cycleId: item.id } })}
      activeOpacity={0.7}
      accessibilityLabel={`View discharge summary for ${item.patientName} cycle ${item.cycleNumber}`}
      accessibilityRole="button"
    >
      <View style={styles.cardLeft}>
        <Avatar name={item.patientName} size="medium" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.patientName}>{item.patientName}</Text>
        <Text style={styles.protocolText}>{item.protocolName} — Cycle {item.cycleNumber}</Text>
        <View style={styles.dateRow}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          <Text style={styles.dateText}>Completed {formatDate(item.completedAt)}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Ionicons name="document-text" size={22} color={Colors.primary} />
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Discharge Summaries" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading summaries...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Discharge Summaries" />

      <FlatList
        data={completedCycles}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        ListHeaderComponent={
          <Text style={styles.countText}>{completedCycles.length} completed cycle{completedCycles.length !== 1 ? 's' : ''}</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Discharge Summaries</Text>
            <Text style={styles.emptyText}>
              Summaries will appear here after treatment cycles are completed
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  countText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginVertical: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  cardLeft: { marginRight: Spacing.md },
  cardContent: { flex: 1 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  patientName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md, color: Colors.textPrimary },
  protocolText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.primary, marginTop: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  dateText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2 },
  emptyTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.lg, color: Colors.textSecondary, marginTop: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xs, paddingHorizontal: Spacing.xl },
});
