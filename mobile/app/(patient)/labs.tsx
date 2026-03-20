/**
 * Patient Lab Results Screen
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Header, Badge } from '../../src/components';
import { labService, LabResult, LabTrend } from '../../src/services/labService';

export default function PatientLabsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [trend, setTrend] = useState<LabTrend | null>(null);

  const loadData = useCallback(async () => {
    try {
      const results = await labService.listLabs();
      setLabs(results);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadTrend = async (param: string) => {
    setSelectedParam(param);
    try {
      const data = await labService.getTrends(param);
      setTrend(data);
    } catch {
      setTrend(null);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const sourceLabel = (s: string) => {
    switch (s) {
      case 'pre_chemo': return 'Pre-Chemo';
      case 'upload': return 'Lab Report';
      default: return s;
    }
  };

  // Collect all unique parameter names
  const allParams = new Set<string>();
  labs.forEach(l => Object.keys(l.parameters || {}).forEach(k => allParams.add(k)));

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Lab Results" showBackButton onBackPress={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Lab Results" showBackButton onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Trend Buttons */}
        {allParams.size > 0 && (
          <View style={styles.trendSection}>
            <Text style={styles.sectionTitle}>View Trends</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendScroll}>
              {Array.from(allParams).map(param => (
                <TouchableOpacity
                  key={param}
                  style={[styles.trendBtn, selectedParam === param && styles.trendBtnActive]}
                  onPress={() => loadTrend(param)}
                >
                  <Text style={[styles.trendBtnText, selectedParam === param && styles.trendBtnTextActive]}>
                    {param}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Simple Trend Display */}
        {trend && trend.points.length > 0 && (
          <Card variant="elevated" padding="medium" style={styles.card}>
            <Text style={styles.trendTitle}>{trend.parameter} Trend</Text>
            {trend.points.map((p, i) => (
              <View key={i} style={styles.trendRow}>
                <Text style={styles.trendDate}>{formatDate(p.date)}</Text>
                <View style={styles.trendBar}>
                  <View style={[styles.trendFill, { width: `${Math.min((p.value / (Math.max(...trend.points.map(x => x.value)) || 1)) * 100, 100)}%` }]} />
                </View>
                <Text style={styles.trendValue}>{p.value}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Lab Results List */}
        <Text style={styles.sectionTitle}>All Results</Text>
        {labs.length === 0 ? (
          <Card variant="default" padding="large" style={styles.card}>
            <View style={styles.center}>
              <Ionicons name="flask-outline" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>No lab results yet</Text>
            </View>
          </Card>
        ) : (
          labs.map(lab => (
            <Card key={lab.id} variant="default" padding="medium" style={styles.card}>
              <View style={styles.labHeader}>
                <Ionicons name="document-text" size={20} color={colors.primary[500]} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.labTitle}>{lab.title}</Text>
                  <Text style={styles.labDate}>{formatDate(lab.labDate)}</Text>
                </View>
                <Badge label={sourceLabel(lab.source)} variant="info" size="small" />
              </View>
              {Object.entries(lab.parameters || {}).length > 0 && (
                <View style={styles.paramsGrid}>
                  {Object.entries(lab.parameters).map(([key, val]) => (
                    <TouchableOpacity key={key} style={styles.paramItem} onPress={() => loadTrend(key)}>
                      <Text style={styles.paramLabel}>{key}</Text>
                      <Text style={styles.paramValue}>{String(val)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>
          ))
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
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.sm },
  trendSection: { marginBottom: spacing.md },
  trendScroll: { flexDirection: 'row' },
  trendBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 20, borderWidth: 1, borderColor: colors.border.light, marginRight: spacing.xs, backgroundColor: '#fff' },
  trendBtnActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  trendBtnText: { fontSize: 13, color: colors.text.secondary },
  trendBtnTextActive: { color: '#fff', fontWeight: '600' },
  trendTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.sm },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  trendDate: { fontSize: 11, color: colors.text.secondary, width: 70 },
  trendBar: { flex: 1, height: 8, backgroundColor: colors.neutral[200], borderRadius: 4, overflow: 'hidden', marginHorizontal: spacing.xs },
  trendFill: { height: '100%', backgroundColor: colors.primary[500], borderRadius: 4 },
  trendValue: { fontSize: 13, fontWeight: '600', color: colors.text.primary, width: 50, textAlign: 'right' },
  labHeader: { flexDirection: 'row', alignItems: 'center' },
  labTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  labDate: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  paramsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light },
  paramItem: { backgroundColor: colors.background.secondary, borderRadius: borderRadius.md, padding: spacing.sm, minWidth: '30%' },
  paramLabel: { fontSize: 11, color: colors.text.tertiary, textTransform: 'capitalize' },
  paramValue: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginTop: 2 },
  emptyText: { fontSize: 16, color: colors.text.secondary, marginTop: spacing.md },
});
