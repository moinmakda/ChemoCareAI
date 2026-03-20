/**
 * OPD Doctor - Register Patient with Treatment Plan
 *
 * Multi-step wizard:
 * 1. Patient details (name, DOB, gender, cancer info)
 * 2. Protocol selection (SOPHIA library)
 * 3. Treatment config (start date, cycles)
 * 4. Confirmation + credentials
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  TextStyle,
  Platform,
  FlatList,
  Share,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Card, Header, Button, Input, Badge } from '../../src/components';
import { apiClient } from '../../src/services/api';
import {
  getSophiaProtocols,
  getSophiaCategories,
  SophiaProtocol,
  SophiaProtocolCategory,
} from '../../src/services/protocolService';

const STEPS = ['Patient Info', 'Protocol', 'Schedule', 'Done'];

export default function RegisterPatientScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Patient data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState(new Date(1980, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('male');
  const [cancerType, setCancerType] = useState('');
  const [cancerStage, setCancerStage] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [phone, setPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');

  // Step 2: Protocol
  const [selectedProtocol, setSelectedProtocol] = useState<SophiaProtocol | null>(null);
  const [showProtocolSearch, setShowProtocolSearch] = useState(false);
  const [protocols, setProtocols] = useState<SophiaProtocol[]>([]);
  const [categories, setCategories] = useState<SophiaProtocolCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [loadingProtocols, setLoadingProtocols] = useState(false);

  // Step 3: Schedule
  const [startDate, setStartDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [plannedCycles, setPlannedCycles] = useState('6');
  const [cycleLengthDays, setCycleLengthDays] = useState('21');
  const [opdNotes, setOpdNotes] = useState('');

  // Step 4: Result
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await getSophiaCategories();
      setCategories(cats);
    } catch {}
  };

  const searchProtocolsApi = async (query: string, category?: string | null) => {
    setLoadingProtocols(true);
    try {
      const params: any = {};
      if (query?.trim()) params.search = query.trim();
      if (category) params.category = category;
      const results = await getSophiaProtocols(Object.keys(params).length > 0 ? params : undefined);
      setProtocols(results);
    } catch {
      setProtocols([]);
    } finally {
      setLoadingProtocols(false);
    }
  };

  const selectProtocol = (protocol: SophiaProtocol) => {
    setSelectedProtocol(protocol);
    setShowProtocolSearch(false);
    setCycleLengthDays(String(protocol.cycleLengthDays || 21));
    setPlannedCycles(String(protocol.totalCycles || 6));
    if (protocol.category && !cancerType) {
      setCancerType(protocol.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    }
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!firstName.trim() || !lastName.trim()) {
        Alert.alert('Required', 'Please enter patient first and last name');
        return false;
      }
      if (!patientEmail.trim() || !patientEmail.includes('@')) {
        Alert.alert('Required', 'Please enter a valid patient email address. Login credentials will be sent to this email.');
        return false;
      }
      return true;
    }
    if (step === 1) {
      if (!selectedProtocol) {
        Alert.alert('Required', 'Please select a treatment protocol');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!plannedCycles || parseInt(plannedCycles) < 1) {
        Alert.alert('Required', 'Please enter number of cycles');
        return false;
      }
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    if (step === 2) {
      submitRegistration();
    } else {
      setStep(step + 1);
    }
  };

  const submitRegistration = async () => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/patients/register-with-plan', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob.toISOString().split('T')[0],
        gender,
        cancer_type: cancerType || undefined,
        cancer_stage: cancerStage || undefined,
        height_cm: heightCm ? parseFloat(heightCm) : undefined,
        weight_kg: weightKg ? parseFloat(weightKg) : undefined,
        phone: phone || undefined,
        patient_email: patientEmail || undefined,
        protocol_code: selectedProtocol?.code,
        protocol_name: selectedProtocol?.name || 'Treatment Protocol',
        start_date: startDate.toISOString().split('T')[0],
        planned_cycles: parseInt(plannedCycles),
        cycle_length_days: parseInt(cycleLengthDays),
        opd_notes: opdNotes || undefined,
      });
      setResult(response.data);
      setStep(3);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareCredentials = async () => {
    if (!result) return;
    try {
      await Share.share({
        message: `ChemoCare Login Credentials\n\nPatient: ${result.patientName}\nEmail: ${result.loginEmail}\nPassword: ${result.loginPassword || 'N/A'}\n\nProtocol: ${result.protocolName}\nStart Date: ${result.startDate}\nCycles: ${result.cyclesCreated}`,
      });
    } catch {}
  };

  // Compute cycle dates preview
  const cycleDates = [];
  const cycleLen = parseInt(cycleLengthDays) || 21;
  const numCycles = parseInt(plannedCycles) || 6;
  for (let i = 0; i < Math.min(numCycles, 12); i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * cycleLen);
    cycleDates.push({ cycle: i + 1, date: d });
  }

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((label, i) => (
        <View key={i} style={styles.stepItem}>
          <View style={[styles.stepCircle, i <= step && styles.stepCircleActive, i < step && styles.stepCircleDone]}>
            {i < step ? (
              <Ionicons name="checkmark" size={14} color="#FFF" />
            ) : (
              <Text style={[styles.stepNumber, i <= step && styles.stepNumberActive]}>{i + 1}</Text>
            )}
          </View>
          <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{label}</Text>
          {i < STEPS.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineActive]} />}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Register Patient" showBackButton onBackPress={() => router.back()} />

      {renderStepIndicator()}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Step 1: Patient Info */}
        {step === 0 && (
          <View>
            <Text style={styles.sectionTitle}>Patient Information</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Input label="First Name *" value={firstName} onChangeText={setFirstName} placeholder="e.g., Rajesh" />
              </View>
              <View style={styles.half}>
                <Input label="Last Name *" value={lastName} onChangeText={setLastName} placeholder="e.g., Kumar" />
              </View>
            </View>

            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.datePickerLabel}>Date of Birth</Text>
              <Text style={styles.datePickerValue}>{dob.toLocaleDateString('en-IN')}</Text>
              <Ionicons name="calendar" size={20} color={Colors.primary} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dob}
                mode="date"
                maximumDate={new Date()}
                onChange={(_, d) => { setShowDatePicker(false); if (d) setDob(d); }}
              />
            )}

            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {['male', 'female', 'other'].map(g => (
                <TouchableOpacity key={g} style={[styles.genderChip, gender === g && styles.genderChipActive]} onPress={() => setGender(g)}>
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Input label="Cancer Type" value={cancerType} onChangeText={setCancerType} placeholder="e.g., DLBCL" />
              </View>
              <View style={styles.half}>
                <Input label="Stage" value={cancerStage} onChangeText={setCancerStage} placeholder="e.g., III" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Input label="Height (cm)" value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" placeholder="170" />
              </View>
              <View style={styles.half}>
                <Input label="Weight (kg)" value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" placeholder="70" />
              </View>
            </View>

            <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" />
            <Input label="Patient Email *" value={patientEmail} onChangeText={setPatientEmail} keyboardType="email-address" placeholder="patient@email.com" autoCapitalize="none" />
          </View>
        )}

        {/* Step 2: Protocol Selection */}
        {step === 1 && !showProtocolSearch && (
          <View>
            <Text style={styles.sectionTitle}>Select Protocol</Text>
            {selectedProtocol ? (
              <Card variant="elevated" padding="medium" style={styles.selectedCard}>
                <Text style={styles.selectedCode}>{selectedProtocol.code}</Text>
                <Text style={styles.selectedName} numberOfLines={2}>{selectedProtocol.name}</Text>
                <Text style={styles.selectedMeta}>
                  {selectedProtocol.cycleLengthDays}d cycle | {selectedProtocol.totalCycles} cycles | {selectedProtocol.drugs.length} drugs
                </Text>
                <View style={styles.chipRow}>
                  {selectedProtocol.drugs.slice(0, 5).map((d, i) => (
                    <View key={i} style={styles.chip}><Text style={styles.chipText}>{d}</Text></View>
                  ))}
                </View>
                <Button title="Change Protocol" variant="outline" onPress={() => { setShowProtocolSearch(true); searchProtocolsApi(''); }} style={{ marginTop: Spacing.md }} />
              </Card>
            ) : (
              <TouchableOpacity style={styles.selectBox} onPress={() => { setShowProtocolSearch(true); searchProtocolsApi(''); }}>
                <Ionicons name="flask-outline" size={40} color={Colors.primary} />
                <Text style={styles.selectBoxTitle}>Choose from SOPHIA Library</Text>
                <Text style={styles.selectBoxSub}>15 curated NHS protocols</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 2: Protocol Search (full screen) */}
        {step === 1 && showProtocolSearch && (
          <View>
            <View style={styles.searchHeader}>
              <TouchableOpacity onPress={() => setShowProtocolSearch(false)}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search protocols..."
                  placeholderTextColor={Colors.textSecondary}
                  value={searchQuery}
                  onChangeText={(v) => { setSearchQuery(v); searchProtocolsApi(v, filterCategory); }}
                  autoFocus
                />
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              <TouchableOpacity style={[styles.catChip, !filterCategory && styles.catChipActive]} onPress={() => { setFilterCategory(null); searchProtocolsApi(searchQuery, null); }}>
                <Text style={[styles.catText, !filterCategory && styles.catTextActive]}>All</Text>
              </TouchableOpacity>
              {categories.map(c => (
                <TouchableOpacity key={c.name} style={[styles.catChip, filterCategory === c.name && styles.catChipActive]} onPress={() => { setFilterCategory(c.name); searchProtocolsApi(searchQuery, c.name); }}>
                  <Text style={[styles.catText, filterCategory === c.name && styles.catTextActive]}>{c.name} ({c.count})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loadingProtocols ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={protocols}
                keyExtractor={p => p.code}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.protoItem} onPress={() => selectProtocol(item)}>
                    <Text style={styles.protoCode}>{item.code}</Text>
                    <Text style={styles.protoName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.protoDrugs} numberOfLines={1}>{item.drugs.join(', ')}</Text>
                    <Text style={styles.protoMeta}>{item.cycleLengthDays}d | {item.totalCycles} cycles</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptySearch}>No protocols found</Text>}
              />
            )}
          </View>
        )}

        {/* Step 3: Schedule */}
        {step === 2 && (
          <View>
            <Text style={styles.sectionTitle}>Treatment Schedule</Text>

            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.datePickerLabel}>Start Date</Text>
              <Text style={styles.datePickerValue}>{startDate.toLocaleDateString('en-IN')}</Text>
              <Ionicons name="calendar" size={20} color={Colors.primary} />
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                minimumDate={new Date()}
                onChange={(_, d) => { setShowStartPicker(false); if (d) setStartDate(d); }}
              />
            )}

            <View style={styles.row}>
              <View style={styles.half}>
                <Input label="Number of Cycles" value={plannedCycles} onChangeText={setPlannedCycles} keyboardType="number-pad" />
              </View>
              <View style={styles.half}>
                <Input label="Cycle Length (days)" value={cycleLengthDays} onChangeText={setCycleLengthDays} keyboardType="number-pad" />
              </View>
            </View>

            <Input label="OPD Notes" value={opdNotes} onChangeText={setOpdNotes} multiline numberOfLines={3} placeholder="Clinical notes..." />

            <Text style={styles.previewTitle}>Cycle Schedule Preview</Text>
            {cycleDates.map(c => (
              <View key={c.cycle} style={styles.cyclePreview}>
                <Badge label={`C${c.cycle}`} variant={c.cycle === 1 ? 'primary' : 'neutral'} size="small" />
                <Text style={styles.cycleDate}>{c.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Step 4: Done */}
        {step === 3 && result && (
          <View style={styles.doneContainer}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
            </View>
            <Text style={styles.doneTitle}>Patient Registered</Text>
            <Text style={styles.doneSub}>{result.patientName || 'Patient'} has been registered with {result.protocolName || 'treatment protocol'}</Text>

            <Card variant="elevated" padding="large" style={styles.credentialsCard}>
              <Text style={styles.credLabel}>Login Credentials</Text>
              <View style={styles.credRow}>
                <Text style={styles.credKey}>Login Email:</Text>
                <Text style={styles.credValue} selectable>{result.loginEmail}</Text>
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credKey}>Password:</Text>
                <Text style={styles.credValue} selectable>{result.loginPassword}</Text>
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credKey}>Cycles:</Text>
                <Text style={styles.credValue}>{result.cyclesCreated} starting {result.startDate}</Text>
              </View>
              {result.emailSentTo && (
                <View style={{ marginTop: 12, padding: 10, backgroundColor: '#F0FDF4', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="mail" size={18} color="#16A34A" />
                  <Text style={{ fontSize: 13, color: '#166534', flex: 1 }}>Credentials sent to {result.emailSentTo}</Text>
                </View>
              )}
            </Card>

            <Button title="Share Credentials" variant="outline" onPress={shareCredentials} style={{ marginTop: Spacing.lg }} icon={<Ionicons name="share-outline" size={20} color={Colors.primary} style={{ marginRight: 8 }} />} />
            <Button title="Done" variant="primary" onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom navigation buttons */}
      {step < 3 && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          {step > 0 && !showProtocolSearch && (
            <Button title="Back" variant="outline" onPress={() => setStep(step - 1)} style={styles.bottomButton} />
          )}
          {!showProtocolSearch && (
            <Button
              title={step === 2 ? 'Register Patient' : 'Next'}
              variant="primary"
              onPress={nextStep}
              loading={isSubmitting}
              style={[styles.bottomButton, { flex: 1 }]}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },

  // Steps
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: Colors.primary },
  stepCircleDone: { backgroundColor: '#22C55E' },
  stepNumber: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  stepNumberActive: { color: '#FFF' },
  stepLabel: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
  stepLabelActive: { color: Colors.primary, fontWeight: '600' },
  stepLine: { position: 'absolute', right: -15, top: 14, width: 30, height: 2, backgroundColor: '#E2E8F0' },
  stepLineActive: { backgroundColor: '#22C55E' },

  // Form
  sectionTitle: { fontSize: 20, fontWeight: '700' as TextStyle['fontWeight'], color: Colors.textPrimary, marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  half: { flex: 1 },
  fieldLabel: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.md },

  datePickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, backgroundColor: '#F1F5F9', borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  datePickerLabel: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  datePickerValue: { fontSize: Typography.fontSize.md, fontWeight: '600', color: Colors.textPrimary },

  genderRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  genderChip: { flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: '#F1F5F9', alignItems: 'center' },
  genderChipActive: { backgroundColor: Colors.primary },
  genderText: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  genderTextActive: { color: '#FFF', fontWeight: '600' },

  // Protocol selector
  selectedCard: { marginBottom: Spacing.md },
  selectedCode: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  selectedName: { fontSize: Typography.fontSize.md, color: Colors.textPrimary, marginTop: 4 },
  selectedMeta: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: Spacing.sm },
  chip: { backgroundColor: '#EBF5FF', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 11, color: Colors.primary },

  selectBox: { alignItems: 'center', padding: Spacing.xl, backgroundColor: '#F8FAFC', borderRadius: BorderRadius.lg, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  selectBoxTitle: { fontSize: Typography.fontSize.lg, fontWeight: '600', color: Colors.textPrimary, marginTop: Spacing.sm },
  selectBoxSub: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginTop: 4 },

  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? Spacing.sm : 4 },
  searchInput: { flex: 1, fontSize: Typography.fontSize.md, color: Colors.textPrimary, marginLeft: 8, padding: 0 },
  catScroll: { marginBottom: Spacing.sm },
  catChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  catChipActive: { backgroundColor: Colors.primary },
  catText: { fontSize: 12, color: Colors.textSecondary, textTransform: 'capitalize' },
  catTextActive: { color: '#FFF', fontWeight: '600' },

  protoItem: { padding: Spacing.md, backgroundColor: '#FFF', borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: '#E2E8F0' },
  protoCode: { fontSize: Typography.fontSize.md, fontWeight: '700', color: Colors.primary },
  protoName: { fontSize: Typography.fontSize.sm, color: Colors.textPrimary, marginTop: 2 },
  protoDrugs: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  protoMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  emptySearch: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },

  // Schedule
  previewTitle: { fontSize: Typography.fontSize.md, fontWeight: '600', color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  cyclePreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  cycleDate: { fontSize: Typography.fontSize.sm, color: Colors.textPrimary },

  // Done
  doneContainer: { alignItems: 'center', paddingTop: Spacing.xl },
  doneIcon: { marginBottom: Spacing.md },
  doneTitle: { fontSize: 24, fontWeight: '700' as TextStyle['fontWeight'], color: Colors.textPrimary },
  doneSub: { fontSize: Typography.fontSize.md, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },

  credentialsCard: { marginTop: Spacing.lg, width: '100%' },
  credLabel: { fontSize: Typography.fontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  credRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  credKey: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  credValue: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.textPrimary },

  // Bottom bar
  bottomBar: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFF' },
  bottomButton: { minWidth: 100 },
});
