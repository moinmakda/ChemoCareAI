/**
 * Patient Treatment Calendar
 * Shows protocol cycles on a calendar with drug schedules, appointments, and day types.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextStyle,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Badge, Header } from '../../src/components';
import { treatmentService } from '../../src/services/treatmentService';
import { rescheduleAppointment, cancelAppointment } from '../../src/services/schedulingService';
import { useAuthStore } from '../../src/store/authStore';

interface CalendarDay {
  date: string;
  dayInCycle: number;
  cycleNumber: number;
  dayType: 'treatment' | 'take_home' | 'lab' | 'rest';
  cycleStatus: string;
  drugs: { name: string; dose: number; unit: string; route: string }[];
  appointments: { id: string; type: string; time?: string; status: string }[];
  notes?: string;
}

interface CalendarData {
  planId: string;
  protocolName: string;
  cycleLengthDays: number;
  totalCycles: number;
  completedCycles: number;
  currentCycle?: number;
  nextTreatmentDate?: string;
  calendarDays: CalendarDay[];
}

const DAY_COLORS = {
  treatment: { key: 'treatment', color: colors.primary[500] },
  take_home: { key: 'takeHome', color: '#22C55E' },
  lab: { key: 'lab', color: '#F59E0B' },
  rest: { key: 'rest', color: colors.neutral[300] },
};

export default function PatientScheduleScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayInfo, setSelectedDayInfo] = useState<CalendarDay[]>([]);
  const [hasPlan, setHasPlan] = useState(true);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<{ id: string; type: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');
  const [timelineItems, setTimelineItems] = useState<any[]>([]);

  const isActionable = (status: string) =>
    ['scheduled', 'confirmed'].includes(status);

  const isFutureDate = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr >= today;
  };

  const handleReschedule = (appointmentId: string, appointmentType: string) => {
    setRescheduleTarget({ id: appointmentId, type: appointmentType });
    setRescheduleDate(new Date());
    setRescheduleModalVisible(true);
  };

  const confirmReschedule = async () => {
    if (!rescheduleTarget) return;
    const dateStr = rescheduleDate.toISOString().split('T')[0];
    setRescheduleModalVisible(false);
    setActionLoading(true);
    try {
      await rescheduleAppointment(rescheduleTarget.id, dateStr);
      Alert.alert('Success', 'Appointment rescheduled successfully.');
      loadCalendar();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to reschedule appointment.');
    } finally {
      setActionLoading(false);
      setRescheduleTarget(null);
    }
  };

  const handleCancel = (appointmentId: string, appointmentType: string) => {
    Alert.alert(
      'Cancel Appointment',
      `Are you sure you want to cancel this ${appointmentType.replace(/_/g, ' ')} appointment?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await cancelAppointment(appointmentId, 'Patient requested cancellation');
              Alert.alert('Cancelled', 'Your appointment has been cancelled.');
              loadCalendar();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to cancel appointment.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const loadCalendar = useCallback(async () => {
    try {
      // Get patient's treatment plans
      const plans = await treatmentService.listTreatmentPlans();
      const activePlan = plans.find((p: any) => p.status === 'active')
        || plans.find((p: any) => p.status === 'approved')
        || plans[0];

      if (!activePlan) {
        setHasPlan(false);
        return;
      }

      // Get calendar data
      const calendar = await treatmentService.getCalendar(activePlan.id);
      setCalendarData(calendar);
      setHasPlan(true);

      // Load timeline data (Feature 5)
      try {
        const timeline = await treatmentService.getTimeline(activePlan.id);
        setTimelineItems(timeline.items || []);
      } catch {
        // silent — timeline is optional
      }

      // Auto-select today or next treatment
      const today = new Date().toISOString().split('T')[0];
      const todayDays = calendar.calendarDays?.filter((d: CalendarDay) => d.date === today) || [];
      if (todayDays.length > 0) {
        setSelectedDate(today);
        setSelectedDayInfo(todayDays);
      } else if (calendar.nextTreatmentDate) {
        setSelectedDate(calendar.nextTreatmentDate);
        const nextDays = calendar.calendarDays?.filter(
          (d: CalendarDay) => d.date === calendar.nextTreatmentDate
        ) || [];
        setSelectedDayInfo(nextDays);
      }
    } catch {
      setHasPlan(false);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCalendar();
  };

  const onDayPress = (day: { dateString: string }) => {
    setSelectedDate(day.dateString);
    const dayInfo = calendarData?.calendarDays?.filter(
      (d) => d.date === day.dateString
    ) || [];
    setSelectedDayInfo(dayInfo);
  };

  // Build markedDates for the calendar
  const getMarkedDates = () => {
    if (!calendarData?.calendarDays) return {};

    const marked: Record<string, any> = {};
    const today = new Date().toISOString().split('T')[0];

    for (const day of calendarData.calendarDays) {
      const existing = marked[day.date] || { dots: [], selected: false };
      const dotConfig = DAY_COLORS[day.dayType] || DAY_COLORS.rest;

      // Only add unique dot types per date
      if (!existing.dots.find((d: any) => d.key === dotConfig.key)) {
        existing.dots.push(dotConfig);
      }

      marked[day.date] = existing;
    }

    // Mark selected date
    if (selectedDate && marked[selectedDate]) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: colors.primary[500],
      };
    } else if (selectedDate) {
      marked[selectedDate] = {
        selected: true,
        selectedColor: colors.primary[500],
        dots: [],
      };
    }

    return marked;
  };

  const getDayTypeLabel = (type: string) => {
    switch (type) {
      case 'treatment': return 'Treatment Day';
      case 'take_home': return 'Take-home Meds';
      case 'lab': return 'Lab / Pre-chemo';
      case 'rest': return 'Rest Day';
      default: return type;
    }
  };

  const getDayTypeColor = (type: string) => {
    return DAY_COLORS[type as keyof typeof DAY_COLORS]?.color || colors.neutral[400];
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Treatment Calendar" />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading your treatment plan...</Text>
        </View>
      </View>
    );
  }

  if (!hasPlan || !calendarData) {
    return (
      <View style={styles.container}>
        <Header title="Treatment Calendar" />
        <View style={styles.centerContent}>
          <Ionicons name="calendar-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No Treatment Plan</Text>
          <Text style={styles.emptyText}>
            Your doctor will assign a treatment protocol during your OPD visit.
            Once assigned, your treatment calendar will appear here.
          </Text>
        </View>
      </View>
    );
  }

  const progress = calendarData.totalCycles > 0
    ? Math.round((calendarData.completedCycles / calendarData.totalCycles) * 100)
    : 0;

  return (
    <View style={styles.container}>
      <Header title="Treatment Calendar" />

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Protocol Header */}
        <Card variant="elevated" padding="medium" style={styles.protocolCard}>
          <Text style={styles.protocolName} numberOfLines={2}>{calendarData.protocolName}</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              Cycle {calendarData.completedCycles} of {calendarData.totalCycles}
            </Text>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          {calendarData.nextTreatmentDate && (
            <View style={styles.nextTreatmentRow}>
              <Ionicons name="time-outline" size={16} color={colors.primary[500]} />
              <Text style={styles.nextTreatmentText}>
                Next treatment: {new Date(calendarData.nextTreatmentDate + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long'
                })}
              </Text>
            </View>
          )}
        </Card>

        {/* View Toggle (Feature 5) */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]}
            onPress={() => setViewMode('calendar')}
            accessibilityLabel="Calendar view"
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'calendar' }}
          >
            <Ionicons name="calendar-outline" size={16} color={viewMode === 'calendar' ? '#fff' : colors.text.secondary} />
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'timeline' && styles.toggleBtnActive]}
            onPress={() => setViewMode('timeline')}
            accessibilityLabel="Timeline view"
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'timeline' }}
          >
            <Ionicons name="list-outline" size={16} color={viewMode === 'timeline' ? '#fff' : colors.text.secondary} />
            <Text style={[styles.toggleText, viewMode === 'timeline' && styles.toggleTextActive]}>Timeline</Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'timeline' ? (
          /* Timeline View */
          <View style={styles.timelineContainer}>
            {timelineItems.length === 0 ? (
              <Text style={styles.noPlanText}>No timeline data available</Text>
            ) : (
              timelineItems.map((item: any, idx: number) => {
                const iconMap: Record<string, string> = {
                  treatment: 'flask',
                  lab: 'water',
                  medication: 'medical',
                  rest: 'bed',
                  appointment: 'calendar',
                };
                const colorMap: Record<string, string> = {
                  treatment: colors.primary[500],
                  lab: '#F59E0B',
                  medication: '#22C55E',
                  rest: colors.neutral[400],
                  appointment: '#3B82F6',
                };
                return (
                  <View key={idx} style={styles.timelineItem}>
                    <View style={styles.timelineLine}>
                      <View style={[styles.timelineDot, { backgroundColor: colorMap[item.type] || colors.neutral[400] }]}>
                        <Ionicons name={(iconMap[item.type] || 'ellipse') as any} size={12} color="#fff" />
                      </View>
                      {idx < timelineItems.length - 1 && <View style={styles.timelineConnector} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineDate}>
                        {new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {item.cycleNumber ? ` · Cycle ${item.cycleNumber}` : ''}
                      </Text>
                      <Text style={styles.timelineTitle}>{item.title}</Text>
                      {item.description && <Text style={styles.timelineDesc}>{item.description}</Text>}
                      {item.isActionRequired && (
                        <View style={styles.actionBadge}>
                          <Ionicons name="alert-circle" size={12} color={colors.primary[500]} />
                          <Text style={styles.actionBadgeText}>Action needed</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
        <>
        {/* Legend */}
        <View style={styles.legend}>
          {Object.entries(DAY_COLORS).map(([key, val]) => (
            <View key={key} style={styles.legendItem} accessibilityLabel={`${getDayTypeLabel(key)} indicator`}>
              <View style={[styles.legendDot, { backgroundColor: val.color }]} />
              <Text style={styles.legendLabel}>{getDayTypeLabel(key)}</Text>
            </View>
          ))}
        </View>

        {/* Calendar */}
        <Card variant="outlined" padding="small" style={styles.calendarCard}>
          <Calendar
            markingType="multi-dot"
            markedDates={getMarkedDates()}
            onDayPress={onDayPress}
            theme={{
              backgroundColor: 'transparent',
              calendarBackground: 'transparent',
              textSectionTitleColor: colors.text.secondary,
              selectedDayBackgroundColor: colors.primary[500],
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: colors.primary[500],
              dayTextColor: colors.text.primary,
              textDisabledColor: colors.neutral[300],
              monthTextColor: colors.text.primary,
              arrowColor: colors.primary[500],
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
              // @ts-ignore - react-native-calendars custom stylesheet key
              'stylesheet.calendar.header': {
                week: {
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  marginTop: 4,
                  marginBottom: 4,
                },
              },
            }}
          />
        </Card>

        {/* Selected Day Details */}
        {selectedDate && (
          <Card variant="outlined" padding="medium" style={styles.dayDetailCard}>
            <Text style={styles.dayDetailDate}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </Text>

            {selectedDayInfo.length === 0 ? (
              <Text style={styles.noPlanText}>No treatment scheduled for this day</Text>
            ) : (
              selectedDayInfo.map((dayInfo, idx) => (
                <View key={idx} style={styles.dayInfoBlock}>
                  {/* Day type badge */}
                  <View style={styles.dayTypeRow}>
                    <View style={[styles.dayTypeBadge, { backgroundColor: getDayTypeColor(dayInfo.dayType) + '20' }]}>
                      <View style={[styles.dayTypeDot, { backgroundColor: getDayTypeColor(dayInfo.dayType) }]} />
                      <Text style={[styles.dayTypeText, { color: getDayTypeColor(dayInfo.dayType) }]}>
                        {getDayTypeLabel(dayInfo.dayType)}
                      </Text>
                    </View>
                    <Text style={styles.cycleLabel}>
                      Cycle {dayInfo.cycleNumber}, Day {dayInfo.dayInCycle}
                    </Text>
                  </View>

                  {/* Drugs for this day */}
                  {dayInfo.drugs.length > 0 && (
                    <View style={styles.drugsList}>
                      {dayInfo.drugs.map((drug, di) => (
                        <View key={di} style={styles.drugRow}>
                          <Ionicons name="flask" size={16} color={colors.primary[500]} />
                          <View style={styles.drugInfo}>
                            <Text style={styles.drugName} numberOfLines={1}>{drug.name}</Text>
                            <Text style={styles.drugDose}>
                              {drug.dose != null ? (typeof drug.dose === 'number' ? drug.dose.toFixed(0) : drug.dose) : '--'} {drug.unit || ''} — {drug.route || ''}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Appointments for this day */}
                  {dayInfo.appointments.length > 0 && (
                    <View style={styles.appointmentsList}>
                      {dayInfo.appointments.map((apt, ai) => (
                        <View key={ai}>
                          <View style={styles.appointmentRow}>
                            <Ionicons name="calendar" size={16} color={colors.info} />
                            <Text style={styles.appointmentText}>
                              {apt.type?.replace(/_/g, ' ')} {apt.time ? `at ${apt.time}` : ''}
                            </Text>
                            <Badge label={apt.status} variant={apt.status === 'completed' ? 'success' : apt.status === 'cancelled' ? 'error' : 'info'} size="small" />
                          </View>
                          {selectedDate && isFutureDate(selectedDate) && isActionable(apt.status) && (
                            <View style={styles.appointmentActions}>
                              <TouchableOpacity
                                style={styles.rescheduleButton}
                                onPress={() => handleReschedule(apt.id, apt.type)}
                                disabled={actionLoading}
                              >
                                <Ionicons name="swap-horizontal" size={14} color={colors.primary[500]} />
                                <Text style={styles.rescheduleButtonText}>Reschedule</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancel(apt.id, apt.type)}
                                disabled={actionLoading}
                              >
                                <Ionicons name="close-circle-outline" size={14} color={colors.error} />
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Rest day message */}
                  {dayInfo.dayType === 'rest' && dayInfo.drugs.length === 0 && (
                    <Text style={styles.restDayText}>
                      Recovery day. Stay hydrated and monitor for any side effects.
                    </Text>
                  )}
                </View>
              ))
            )}
          </Card>
        )}

        <View style={{ height: 40 }} />
        </>
        )}
      </ScrollView>

      {/* Reschedule: Android uses native dialog, iOS uses modal with spinner */}
      {Platform.OS === 'android' && rescheduleModalVisible && (
        <DateTimePicker
          value={rescheduleDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event, date) => {
            if (event.type === 'dismissed') {
              setRescheduleModalVisible(false);
              return;
            }
            if (date) {
              setRescheduleDate(date);
              setRescheduleModalVisible(false);
              // Auto-confirm on Android after date selection
              setTimeout(() => {
                if (rescheduleTarget) {
                  const dateStr = date.toISOString().split('T')[0];
                  Alert.alert(
                    'Confirm Reschedule',
                    `Reschedule to ${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Confirm', onPress: () => {
                        setActionLoading(true);
                        rescheduleAppointment(rescheduleTarget.id, dateStr)
                          .then(() => { Alert.alert('Success', 'Appointment rescheduled.'); loadCalendar(); })
                          .catch((err: any) => Alert.alert('Error', err?.message || 'Failed to reschedule.'))
                          .finally(() => { setActionLoading(false); setRescheduleTarget(null); });
                      }},
                    ]
                  );
                }
              }, 300);
            }
          }}
        />
      )}

      {/* iOS Reschedule Modal */}
      {Platform.OS === 'ios' && (
      <Modal
        visible={rescheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRescheduleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setRescheduleModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reschedule Appointment</Text>
            <Text style={styles.modalSubtitle}>Select a new date:</Text>

            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              <DateTimePicker
                value={rescheduleDate}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_, date) => { if (date) setRescheduleDate(date); }}
                style={{ height: 150, width: '100%' }}
              />
            </View>

            <Text style={{ textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: 12 }}>
              {rescheduleDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRescheduleModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmReschedule}
              >
                <Text style={styles.modalConfirmText}>Reschedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      )}

      {/* Loading overlay */}
      {actionLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  scrollView: { flex: 1 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: typography.body.fontSize, color: colors.text.secondary },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.text.primary, marginTop: spacing.md },
  emptyText: { fontSize: typography.body.fontSize, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },

  // Protocol header
  protocolCard: { margin: spacing.lg, marginBottom: spacing.sm },
  protocolName: { fontSize: 18, fontWeight: '700' as TextStyle['fontWeight'], color: colors.primary[600] },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  progressLabel: { fontSize: typography.body.fontSize, color: colors.text.secondary },
  progressPercent: { fontSize: typography.body.fontSize, fontWeight: '700' as TextStyle['fontWeight'], color: colors.primary[500] },
  progressBar: { height: 8, backgroundColor: colors.neutral[200], borderRadius: 4, marginTop: spacing.xs, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary[500], borderRadius: 4 },
  nextTreatmentRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.xs },
  nextTreatmentText: { fontSize: typography.callout.fontSize, color: colors.primary[500], fontWeight: '500' },

  // Legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: colors.text.secondary },

  // Calendar
  calendarCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md },

  // Day detail
  dayDetailCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  dayDetailDate: { fontSize: typography.headline.fontSize, fontWeight: '600' as TextStyle['fontWeight'], color: colors.text.primary, marginBottom: spacing.md },
  noPlanText: { fontSize: typography.body.fontSize, color: colors.text.tertiary, fontStyle: 'italic' },
  dayInfoBlock: { marginBottom: spacing.md },
  dayTypeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  dayTypeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 20, gap: 6 },
  dayTypeDot: { width: 8, height: 8, borderRadius: 4 },
  dayTypeText: { fontSize: 13, fontWeight: '600' },
  cycleLabel: { fontSize: 13, color: colors.text.tertiary },

  // Drugs
  drugsList: { marginTop: spacing.xs },
  drugRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  drugInfo: { flex: 1 },
  drugName: { fontSize: typography.body.fontSize, fontWeight: '500', color: colors.text.primary },
  drugDose: { fontSize: typography.caption1.fontSize, color: colors.text.secondary, marginTop: 2 },

  // Appointments
  appointmentsList: { marginTop: spacing.sm },
  appointmentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  appointmentText: { flex: 1, fontSize: typography.body.fontSize, color: colors.text.primary, textTransform: 'capitalize' },

  // Rest day
  restDayText: { fontSize: typography.body.fontSize, color: colors.text.secondary, fontStyle: 'italic', marginTop: spacing.xs },

  // Appointment actions
  appointmentActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    marginLeft: spacing.lg + 4,
    marginBottom: spacing.xs,
  },
  rescheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.primary[500] + '15',
    borderWidth: 1,
    borderColor: colors.primary[500] + '30',
  },
  rescheduleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[500],
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  modalConfirmBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary[500],
  },
  modalConfirmText: {
    fontSize: typography.body.fontSize,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // View toggle
  viewToggle: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.neutral[200], borderRadius: 10, padding: 3 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, gap: 4 },
  toggleBtnActive: { backgroundColor: colors.primary[500] },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  toggleTextActive: { color: '#fff' },

  // Timeline
  timelineContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  timelineItem: { flexDirection: 'row', minHeight: 60 },
  timelineLine: { width: 30, alignItems: 'center' },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineConnector: { width: 2, flex: 1, backgroundColor: colors.neutral[300], marginTop: -2 },
  timelineContent: { flex: 1, paddingLeft: spacing.sm, paddingBottom: spacing.md },
  timelineDate: { fontSize: 11, color: colors.text.tertiary, marginBottom: 2 },
  timelineTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  timelineDesc: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  actionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  actionBadgeText: { fontSize: 11, color: colors.primary[500], fontWeight: '500' },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
