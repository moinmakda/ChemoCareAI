/**
 * Patient Vitals Screen - Health metrics tracking
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/constants/theme';
import { Card, Header, Button, Modal, Input } from '../../src/components';

interface VitalReading {
  id: string;
  type: 'temperature' | 'bloodPressure' | 'heartRate' | 'weight' | 'oxygen';
  value: string;
  unit: string;
  timestamp: string;
  status: 'normal' | 'warning' | 'critical';
}

interface VitalData {
  type: string;
  label: string;
  value: string;
  unit: string;
  icon: string;
  color: string;
  status: 'normal' | 'warning' | 'critical';
  range: string;
}

export default function PatientVitalsScreen() {
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedVital, setSelectedVital] = useState<string | null>(null);

  // Mock current vitals
  const currentVitals: VitalData[] = [
    {
      type: 'temperature',
      label: 'Temperature',
      value: '37.2',
      unit: '°C',
      icon: 'thermometer-outline',
      color: colors.primary[500],
      status: 'normal',
      range: '36.1 - 37.2°C',
    },
    {
      type: 'bloodPressure',
      label: 'Blood Pressure',
      value: '120/80',
      unit: 'mmHg',
      icon: 'pulse-outline',
      color: colors.error,
      status: 'normal',
      range: '< 120/80 mmHg',
    },
    {
      type: 'heartRate',
      label: 'Heart Rate',
      value: '72',
      unit: 'bpm',
      icon: 'heart-outline',
      color: colors.success,
      status: 'normal',
      range: '60 - 100 bpm',
    },
    {
      type: 'oxygen',
      label: 'Oxygen Level',
      value: '98',
      unit: '%',
      icon: 'water-outline',
      color: colors.info,
      status: 'normal',
      range: '95 - 100%',
    },
    {
      type: 'weight',
      label: 'Weight',
      value: '68',
      unit: 'kg',
      icon: 'scale-outline',
      color: colors.warning,
      status: 'normal',
      range: 'Track changes',
    },
  ];

  // Mock history
  const vitalHistory: VitalReading[] = [
    {
      id: '1',
      type: 'temperature',
      value: '37.2',
      unit: '°C',
      timestamp: '2024-01-14 09:30 AM',
      status: 'normal',
    },
    {
      id: '2',
      type: 'bloodPressure',
      value: '120/80',
      unit: 'mmHg',
      timestamp: '2024-01-14 09:30 AM',
      status: 'normal',
    },
    {
      id: '3',
      type: 'temperature',
      value: '37.8',
      unit: '°C',
      timestamp: '2024-01-13 10:00 AM',
      status: 'warning',
    },
    {
      id: '4',
      type: 'heartRate',
      value: '85',
      unit: 'bpm',
      timestamp: '2024-01-13 10:00 AM',
      status: 'normal',
    },
  ];

  const getStatusColor = (status: VitalReading['status']): string => {
    switch (status) {
      case 'normal':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'critical':
        return colors.error;
    }
  };

  const handleLogVital = (type: string) => {
    setSelectedVital(type);
    setShowLogModal(true);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Vitals"
        rightComponent={
          <TouchableOpacity onPress={() => setShowLogModal(true)}>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary[500]} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Vitals Grid */}
        <Text style={styles.sectionTitle}>Current Readings</Text>
        <View style={styles.vitalsGrid}>
          {currentVitals.map((vital) => (
            <TouchableOpacity
              key={vital.type}
              style={styles.vitalCard}
              onPress={() => handleLogVital(vital.type)}
              activeOpacity={0.7}
            >
              <View style={[styles.vitalIcon, { backgroundColor: `${vital.color}15` }]}>
                <Ionicons name={vital.icon as any} size={24} color={vital.color} />
              </View>
              <Text style={styles.vitalLabel}>{vital.label}</Text>
              <View style={styles.vitalValueRow}>
                <Text style={styles.vitalValue}>{vital.value}</Text>
                <Text style={styles.vitalUnit}>{vital.unit}</Text>
              </View>
              <Text style={styles.vitalRange}>{vital.range}</Text>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(vital.status) }]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Log Buttons */}
        <Card variant="default" padding="medium" style={styles.quickLogCard}>
          <Text style={styles.quickLogTitle}>Quick Log</Text>
          <Text style={styles.quickLogSubtitle}>
            Tap a vital above or use quick buttons below
          </Text>
          <View style={styles.quickLogButtons}>
            <Button
              title="Log All Vitals"
              variant="primary"
              size="medium"
              onPress={() => setShowLogModal(true)}
              fullWidth
            />
          </View>
        </Card>

        {/* History */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Recent History</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {vitalHistory.map((reading) => (
            <Card key={reading.id} variant="default" padding="medium" style={styles.historyCard}>
              <View style={styles.historyRow}>
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(reading.status) }]} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyType}>
                    {currentVitals.find((v) => v.type === reading.type)?.label}
                  </Text>
                  <Text style={styles.historyTimestamp}>{reading.timestamp}</Text>
                </View>
                <View style={styles.historyValue}>
                  <Text style={styles.historyValueText}>{reading.value}</Text>
                  <Text style={styles.historyUnitText}>{reading.unit}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Tips */}
        <Card variant="filled" padding="medium" style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb-outline" size={20} color={colors.warning} />
            <Text style={styles.tipsTitle}>Monitoring Tips</Text>
          </View>
          <Text style={styles.tipsText}>
            • Log your vitals at the same time each day for consistency{'\n'}
            • Report any readings outside normal range to your care team{'\n'}
            • Track symptoms along with vitals for better care insights
          </Text>
        </Card>
      </ScrollView>

      {/* Log Vital Modal */}
      <Modal
        visible={showLogModal}
        onClose={() => {
          setShowLogModal(false);
          setSelectedVital(null);
        }}
        title="Log Vitals"
        size="medium"
      >
        <View style={styles.modalContent}>
          <Input
            label="Temperature"
            placeholder="e.g., 37.0"
            keyboardType="decimal-pad"
            leftIcon="thermometer-outline"
          />
          <Input
            label="Blood Pressure (Systolic/Diastolic)"
            placeholder="e.g., 120/80"
            keyboardType="numbers-and-punctuation"
            leftIcon="pulse-outline"
          />
          <Input
            label="Heart Rate"
            placeholder="e.g., 72"
            keyboardType="number-pad"
            leftIcon="heart-outline"
          />
          <Input
            label="Oxygen Level"
            placeholder="e.g., 98"
            keyboardType="number-pad"
            leftIcon="water-outline"
          />
          <Input
            label="Weight (kg)"
            placeholder="e.g., 68"
            keyboardType="decimal-pad"
            leftIcon="scale-outline"
          />
          <Input
            label="Notes (optional)"
            placeholder="Any symptoms or observations..."
            multiline
            numberOfLines={3}
          />
          <View style={styles.modalFooter}>
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setShowLogModal(false)}
            />
            <Button
              title="Save"
              variant="primary"
              onPress={() => setShowLogModal(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  vitalCard: {
    width: '48%',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    position: 'relative',
    ...shadows.sm,
  } as ViewStyle,
  vitalIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  vitalLabel: {
    fontWeight: '500',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
  },
  vitalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
  vitalValue: {
    fontWeight: '700',
    fontSize: typography.title1.fontSize,
    color: colors.text.primary,
  },
  vitalUnit: {
    fontWeight: '400',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  vitalRange: {
    fontWeight: '400',
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  statusDot: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quickLogCard: {
    marginTop: spacing.lg,
    alignItems: 'center',
  } as ViewStyle,
  quickLogTitle: {
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    marginBottom: 2,
  },
  quickLogSubtitle: {
    fontWeight: '400',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  quickLogButtons: {
    width: '100%',
  },
  historySection: {
    marginTop: spacing.lg,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewAllText: {
    fontWeight: '500',
    fontSize: typography.caption1.fontSize,
    color: colors.primary[500],
  },
  historyCard: {
    marginBottom: spacing.sm,
  } as ViewStyle,
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  historyContent: {
    flex: 1,
  },
  historyType: {
    fontWeight: '500',
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
  },
  historyTimestamp: {
    fontWeight: '400',
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  historyValue: {
    alignItems: 'flex-end',
  },
  historyValueText: {
    fontWeight: '700',
    fontSize: typography.title3.fontSize,
    color: colors.text.primary,
  },
  historyUnitText: {
    fontWeight: '400',
    fontSize: 11,
    color: colors.text.secondary,
  },
  tipsCard: {
    marginTop: spacing.lg,
  } as ViewStyle,
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tipsTitle: {
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  tipsText: {
    fontWeight: '400',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  modalContent: {
    gap: spacing.sm,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
