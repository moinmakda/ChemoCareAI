/**
 * Patient Vitals Screen - Real-time health metrics tracking
 * Patients can log their own vitals and view history
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/constants/theme';
import { Card, Header, Button, Modal, Input } from '../../src/components';
import { vitalsService, PatientVitalCreate } from '../../src/services/vitalsService';
import type { Vital } from '../../src/types';

export default function PatientVitalsScreen() {
  const insets = useSafeAreaInsets();
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state for logging vitals
  const [formData, setFormData] = useState<PatientVitalCreate>({
    temperature_f: undefined,
    pulse_bpm: undefined,
    blood_pressure_systolic: undefined,
    blood_pressure_diastolic: undefined,
    oxygen_saturation: undefined,
    weight_kg: undefined,
    pain_score: undefined,
    notes: '',
  });

  const loadVitals = async () => {
    try {
      const data = await vitalsService.getMyVitals(30);
      setVitals(data);
    } catch (error: any) {
      console.error('Error loading vitals:', error);
      if (error.response?.status !== 404) {
        Alert.alert('Error', 'Failed to load vitals history');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVitals();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVitals();
    setRefreshing(false);
  }, []);

  const resetForm = () => {
    setFormData({
      temperature_f: undefined,
      pulse_bpm: undefined,
      blood_pressure_systolic: undefined,
      blood_pressure_diastolic: undefined,
      oxygen_saturation: undefined,
      weight_kg: undefined,
      pain_score: undefined,
      notes: '',
    });
  };

  const handleSaveVitals = async () => {
    // Validate at least one vital is provided
    const hasValue = Object.entries(formData).some(([key, value]) => {
      if (key === 'notes') return false;
      return value !== undefined && value !== '';
    });

    if (!hasValue) {
      Alert.alert('Required', 'Please enter at least one vital measurement');
      return;
    }

    setIsSaving(true);
    try {
      const result = await vitalsService.logMyVitals(formData);
      
      // Check for alerts
      if (result.aiAlerts && result.aiAlerts.length > 0) {
        const criticalAlerts = result.aiAlerts.filter(a => a.severity === 'critical');
        if (criticalAlerts.length > 0) {
          Alert.alert(
            '⚠️ Critical Alert',
            criticalAlerts.map(a => a.message).join('\n'),
            [{ text: 'OK', style: 'destructive' }]
          );
        } else {
          Alert.alert(
            '⚠️ Health Alert',
            result.aiAlerts.map(a => a.message).join('\n')
          );
        }
      } else {
        Alert.alert('Success', 'Vitals logged successfully');
      }
      
      setShowLogModal(false);
      resetForm();
      await loadVitals();
    } catch (error: any) {
      console.error('Error saving vitals:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save vitals');
    } finally {
      setIsSaving(false);
    }
  };

  const getLatestVital = (): Vital | null => {
    return vitals.length > 0 ? vitals[0] : null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      const diffMins = Math.round(diffMs / (1000 * 60));
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${Math.round(diffHours)} hours ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  };

  const getVitalStatus = (type: string, value: number): 'normal' | 'warning' | 'critical' => {
    switch (type) {
      case 'temperature':
        if (value > 101.3) return 'critical';
        if (value > 100.4) return 'warning';
        return 'normal';
      case 'oxygen':
        if (value < 90) return 'critical';
        if (value < 95) return 'warning';
        return 'normal';
      case 'pulse':
        if (value < 50 || value > 120) return 'critical';
        if (value < 60 || value > 100) return 'warning';
        return 'normal';
      case 'systolic':
        if (value > 180 || value < 80) return 'critical';
        if (value > 140 || value < 90) return 'warning';
        return 'normal';
      default:
        return 'normal';
    }
  };

  const getStatusColor = (status: 'normal' | 'warning' | 'critical') => {
    switch (status) {
      case 'critical': return colors.error;
      case 'warning': return colors.warning;
      default: return colors.success;
    }
  };

  const latestVital = getLatestVital();

  const vitalCards = [
    {
      type: 'temperature',
      label: 'Temperature',
      value: latestVital?.temperatureF,
      unit: '°F',
      icon: 'thermometer-outline',
      color: colors.primary[500],
      normalRange: '97.8 - 99.1°F',
    },
    {
      type: 'pulse',
      label: 'Heart Rate',
      value: latestVital?.pulseBpm,
      unit: 'bpm',
      icon: 'heart-outline',
      color: colors.error,
      normalRange: '60 - 100 bpm',
    },
    {
      type: 'bp',
      label: 'Blood Pressure',
      value: latestVital?.bloodPressureSystolic && latestVital?.bloodPressureDiastolic
        ? `${latestVital.bloodPressureSystolic}/${latestVital.bloodPressureDiastolic}`
        : undefined,
      unit: 'mmHg',
      icon: 'pulse-outline',
      color: colors.info,
      normalRange: '< 120/80 mmHg',
    },
    {
      type: 'oxygen',
      label: 'Oxygen Level',
      value: latestVital?.oxygenSaturation,
      unit: '%',
      icon: 'water-outline',
      color: colors.success,
      normalRange: '95 - 100%',
    },
    {
      type: 'weight',
      label: 'Weight',
      value: latestVital?.weightKg,
      unit: 'kg',
      icon: 'scale-outline',
      color: colors.warning,
      normalRange: 'Track changes',
    },
    {
      type: 'pain',
      label: 'Pain Score',
      value: latestVital?.painScore,
      unit: '/10',
      icon: 'medical-outline',
      color: colors.error,
      normalRange: '0 = No pain',
    },
  ];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="My Vitals" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading vitals...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="My Vitals"
        rightComponent={
          <TouchableOpacity onPress={() => setShowLogModal(true)}>
            <Ionicons name="add-circle" size={28} color={colors.primary[500]} />
          </TouchableOpacity>
        }
      />

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
        {/* Last Updated */}
        {latestVital && (
          <Text style={styles.lastUpdated}>
            Last updated: {formatDate(latestVital.recordedAt)}
          </Text>
        )}

        {/* Current Vitals Grid */}
        <Text style={styles.sectionTitle}>Current Readings</Text>
        <View style={styles.vitalsGrid}>
          {vitalCards.map((vital) => {
            const status = vital.value !== undefined && typeof vital.value === 'number'
              ? getVitalStatus(vital.type, vital.value)
              : 'normal';
            
            return (
              <View key={vital.type} style={styles.vitalCard}>
                <View style={[styles.vitalIcon, { backgroundColor: `${vital.color}15` }]}>
                  <Ionicons name={vital.icon as any} size={24} color={vital.color} />
                </View>
                <Text style={styles.vitalLabel}>{vital.label}</Text>
                <View style={styles.vitalValueRow}>
                  <Text style={styles.vitalValue}>
                    {vital.value !== undefined ? vital.value : '--'}
                  </Text>
                  <Text style={styles.vitalUnit}>{vital.unit}</Text>
                </View>
                <Text style={styles.vitalRange}>{vital.normalRange}</Text>
                {vital.value !== undefined && (
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Quick Log Button */}
        <Button
          title="Log New Vitals"
          variant="primary"
          size="large"
          onPress={() => setShowLogModal(true)}
          style={styles.logButton}
          fullWidth
        />

        {/* History */}
        <Text style={styles.sectionTitle}>History</Text>
        {vitals.length === 0 ? (
          <Card variant="default" padding="large">
            <View style={styles.emptyState}>
              <Ionicons name="pulse-outline" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>No vitals recorded yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to log your first reading
              </Text>
            </View>
          </Card>
        ) : (
          vitals.slice(0, 10).map((vital, index) => (
            <Card key={vital.id || index} variant="default" padding="medium" style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>{formatDate(vital.recordedAt)}</Text>
                {vital.timing === 'self_reported' && (
                  <Text style={styles.selfReportedBadge}>Self-reported</Text>
                )}
              </View>
              <View style={styles.historyVitals}>
                {vital.temperatureF && (
                  <View style={styles.historyVitalItem}>
                    <Text style={styles.historyVitalValue}>{vital.temperatureF}°F</Text>
                    <Text style={styles.historyVitalLabel}>Temp</Text>
                  </View>
                )}
                {vital.pulseBpm && (
                  <View style={styles.historyVitalItem}>
                    <Text style={styles.historyVitalValue}>{vital.pulseBpm}</Text>
                    <Text style={styles.historyVitalLabel}>Pulse</Text>
                  </View>
                )}
                {vital.bloodPressureSystolic && (
                  <View style={styles.historyVitalItem}>
                    <Text style={styles.historyVitalValue}>
                      {vital.bloodPressureSystolic}/{vital.bloodPressureDiastolic}
                    </Text>
                    <Text style={styles.historyVitalLabel}>BP</Text>
                  </View>
                )}
                {vital.oxygenSaturation && (
                  <View style={styles.historyVitalItem}>
                    <Text style={styles.historyVitalValue}>{vital.oxygenSaturation}%</Text>
                    <Text style={styles.historyVitalLabel}>O2</Text>
                  </View>
                )}
                {vital.weightKg && (
                  <View style={styles.historyVitalItem}>
                    <Text style={styles.historyVitalValue}>{vital.weightKg}kg</Text>
                    <Text style={styles.historyVitalLabel}>Weight</Text>
                  </View>
                )}
              </View>
              {vital.notes && (
                <Text style={styles.historyNotes}>{vital.notes}</Text>
              )}
              {vital.aiAlerts && vital.aiAlerts.length > 0 && (
                <View style={styles.alertsContainer}>
                  {vital.aiAlerts.map((alert, i) => (
                    <View key={i} style={[styles.alertBadge, { backgroundColor: alert.severity === 'critical' ? colors.error : colors.warning }]}>
                      <Ionicons name="warning" size={12} color={colors.neutral[0]} />
                      <Text style={styles.alertText}>{alert.message}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Log Vitals Modal */}
      <Modal
        visible={showLogModal}
        onClose={() => {
          setShowLogModal(false);
          resetForm();
        }}
        title="Log Vitals"
      >
        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalSubtitle}>
            Enter your current readings. Leave blank any you don't have.
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="Temperature (°F)"
                placeholder="e.g., 98.6"
                value={formData.temperature_f?.toString() || ''}
                onChangeText={(v) => setFormData({ ...formData, temperature_f: v ? parseFloat(v) : undefined })}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Heart Rate (bpm)"
                placeholder="e.g., 72"
                value={formData.pulse_bpm?.toString() || ''}
                onChangeText={(v) => setFormData({ ...formData, pulse_bpm: v ? parseInt(v) : undefined })}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="BP Systolic"
                placeholder="e.g., 120"
                value={formData.blood_pressure_systolic?.toString() || ''}
                onChangeText={(v) => setFormData({ ...formData, blood_pressure_systolic: v ? parseInt(v) : undefined })}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="BP Diastolic"
                placeholder="e.g., 80"
                value={formData.blood_pressure_diastolic?.toString() || ''}
                onChangeText={(v) => setFormData({ ...formData, blood_pressure_diastolic: v ? parseInt(v) : undefined })}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="Oxygen Level (%)"
                placeholder="e.g., 98"
                value={formData.oxygen_saturation?.toString() || ''}
                onChangeText={(v) => setFormData({ ...formData, oxygen_saturation: v ? parseInt(v) : undefined })}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Weight (kg)"
                placeholder="e.g., 70"
                value={formData.weight_kg?.toString() || ''}
                onChangeText={(v) => setFormData({ ...formData, weight_kg: v ? parseFloat(v) : undefined })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Input
            label="Pain Score (0-10)"
            placeholder="0 = no pain, 10 = worst pain"
            value={formData.pain_score?.toString() || ''}
            onChangeText={(v) => {
              const num = parseInt(v);
              if (v === '' || (num >= 0 && num <= 10)) {
                setFormData({ ...formData, pain_score: v ? num : undefined });
              }
            }}
            keyboardType="number-pad"
          />

          <Input
            label="Notes (optional)"
            placeholder="Any symptoms or observations..."
            value={formData.notes || ''}
            onChangeText={(v) => setFormData({ ...formData, notes: v })}
            multiline
            numberOfLines={3}
          />

          <Button
            title="Save Vitals"
            variant="primary"
            size="large"
            onPress={handleSaveVitals}
            loading={isSaving}
            fullWidth
            style={styles.saveButton}
          />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  lastUpdated: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  vitalCard: {
    width: '47%',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    position: 'relative',
    ...shadows.sm,
  },
  vitalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  vitalLabel: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  vitalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  vitalValue: {
    fontSize: typography.title2.fontSize,
    fontWeight: typography.title2.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  vitalUnit: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
    marginLeft: 2,
  },
  vitalRange: {
    fontSize: typography.caption2.fontSize,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  statusDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  logButton: {
    marginBottom: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  historyCard: {
    marginBottom: spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  historyDate: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
  },
  selfReportedBadge: {
    fontSize: typography.caption2.fontSize,
    color: colors.primary[500],
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  historyVitals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  historyVitalItem: {
    alignItems: 'center',
  },
  historyVitalValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
  },
  historyVitalLabel: {
    fontSize: typography.caption2.fontSize,
    color: colors.text.tertiary,
  },
  historyNotes: {
    marginTop: spacing.sm,
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  alertsContainer: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  alertText: {
    fontSize: typography.caption2.fontSize,
    color: colors.neutral[0],
    fontWeight: '500',
  },
  modalScroll: {
    flexGrow: 1,
  },
  modalSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputHalf: {
    flex: 1,
  },
  saveButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
