/**
 * Patient Treatment Costs Screen
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Header } from '../../src/components';
import { treatmentService } from '../../src/services/treatmentService';

export default function PatientCostsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [costData, setCostData] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const plans = await treatmentService.listTreatmentPlans();
      const activePlan = plans.find((p: any) => p.status === 'active') || plans.find((p: any) => p.status === 'approved') || plans[0];
      if (activePlan) {
        const costs = await treatmentService.getCosts(activePlan.id);
        setCostData(costs);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatCurrency = (val?: number | null) => {
    if (val == null || val === 0) return '--';
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Treatment Costs" showBackButton onBackPress={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Treatment Costs" showBackButton onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!costData ? (
          <Card variant="default" padding="large" style={styles.card}>
            <View style={styles.center}>
              <Ionicons name="cash-outline" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>No cost data available</Text>
            </View>
          </Card>
        ) : (
          <>
            {/* Summary */}
            <Card variant="elevated" padding="medium" style={styles.card}>
              <Text style={styles.protocolName}>{costData.protocolName}</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Spent</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(costData.totalSpent)}</Text>
                </View>
                {costData.estimatedTotalCost && (
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Estimated Total</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(costData.estimatedTotalCost)}</Text>
                  </View>
                )}
              </View>
              {costData.estimatedTotalCost > 0 && (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min((costData.totalSpent / costData.estimatedTotalCost) * 100, 100)}%` }]} />
                </View>
              )}
            </Card>

            {/* Per-cycle breakdown */}
            <Text style={styles.sectionTitle}>Cycle Breakdown</Text>
            {(costData.cycles || []).map((cycle: any) => (
              <Card key={cycle.cycleId} variant="default" padding="medium" style={styles.card}>
                <View style={styles.cycleHeader}>
                  <Text style={styles.cycleTitle}>Cycle {cycle.cycleNumber}</Text>
                  <Text style={styles.cycleTotal}>{formatCurrency(cycle.cycleTotal)}</Text>
                </View>
                {cycle.sessionCost != null && (
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Session</Text>
                    <Text style={styles.costValue}>{formatCurrency(cycle.sessionCost)}</Text>
                  </View>
                )}
                {cycle.labCost != null && (
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Lab Work</Text>
                    <Text style={styles.costValue}>{formatCurrency(cycle.labCost)}</Text>
                  </View>
                )}
                {cycle.otherCharges != null && (
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Other</Text>
                    <Text style={styles.costValue}>{formatCurrency(cycle.otherCharges)}</Text>
                  </View>
                )}
                {(cycle.drugCosts || []).map((d: any, i: number) => (
                  <View key={i} style={styles.costRow}>
                    <Text style={styles.costLabel}>{d.drugName}</Text>
                    <Text style={styles.costValue}>{formatCurrency(d.totalCost)}</Text>
                  </View>
                ))}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  card: { marginBottom: spacing.md },
  protocolName: { fontSize: 17, fontWeight: '700', color: colors.primary[600], marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.sm },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: colors.text.secondary },
  summaryValue: { fontSize: 22, fontWeight: '700', color: colors.text.primary, marginTop: 2 },
  progressBar: { height: 8, backgroundColor: colors.neutral[200], borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary[500], borderRadius: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.sm, marginTop: spacing.sm },
  cycleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  cycleTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  cycleTotal: { fontSize: 16, fontWeight: '700', color: colors.primary[500] },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  costLabel: { fontSize: 14, color: colors.text.secondary },
  costValue: { fontSize: 14, fontWeight: '500', color: colors.text.primary },
  emptyText: { fontSize: 16, color: colors.text.secondary, marginTop: spacing.md },
});
