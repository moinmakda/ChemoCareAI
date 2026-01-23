/**
 * Patient Onboarding Screen - Complete profile after registration
 * This is shown when a patient user has no profile yet
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Button, Input, Select } from '../../src/components';
import { patientService } from '../../src/services';
import { usePatientStore } from '../../src/store/patientStore';

// Steps in onboarding
type OnboardingStep = 'basic' | 'medical' | 'emergency' | 'complete';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

const BLOOD_GROUP_OPTIONS = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' },
  { label: "Don't Know", value: '' },
];

const CANCER_TYPE_OPTIONS = [
  { label: 'Breast Cancer', value: 'Breast Cancer' },
  { label: 'Lung Cancer', value: 'Lung Cancer' },
  { label: 'Colorectal Cancer', value: 'Colorectal Cancer' },
  { label: 'Prostate Cancer', value: 'Prostate Cancer' },
  { label: 'Lymphoma', value: 'Lymphoma' },
  { label: 'Leukemia', value: 'Leukemia' },
  { label: 'Ovarian Cancer', value: 'Ovarian Cancer' },
  { label: 'Pancreatic Cancer', value: 'Pancreatic Cancer' },
  { label: 'Stomach Cancer', value: 'Stomach Cancer' },
  { label: 'Liver Cancer', value: 'Liver Cancer' },
  { label: 'Other', value: 'Other' },
];

const CANCER_STAGE_OPTIONS = [
  { label: 'Stage 0 (In Situ)', value: 'Stage 0' },
  { label: 'Stage I (Early)', value: 'Stage I' },
  { label: 'Stage II (Localized)', value: 'Stage II' },
  { label: 'Stage III (Regional)', value: 'Stage III' },
  { label: 'Stage IV (Metastatic)', value: 'Stage IV' },
  { label: 'Unknown/Not Staged', value: 'Unknown' },
];

export default function PatientOnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fetchCurrentPatient } = usePatientStore();
  
  const [step, setStep] = useState<OnboardingStep>('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    // Basic Info
    firstName: '',
    lastName: '',
    dateOfBirth: new Date(1990, 0, 1),
    gender: '',
    bloodGroup: '',
    
    // Medical Info
    cancerType: '',
    cancerStage: '',
    diagnosisDate: new Date(),
    allergies: '',
    comorbidities: '',
    
    // Emergency Contact
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    
    // Physical
    heightCm: '',
    weightKg: '',
  });

  const updateForm = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateBasicInfo = () => {
    if (!formData.firstName.trim()) {
      Alert.alert('Required', 'Please enter your first name');
      return false;
    }
    if (!formData.lastName.trim()) {
      Alert.alert('Required', 'Please enter your last name');
      return false;
    }
    if (!formData.gender) {
      Alert.alert('Required', 'Please select your gender');
      return false;
    }
    return true;
  };

  const validateMedicalInfo = () => {
    if (!formData.cancerType) {
      Alert.alert('Required', 'Please select your cancer type');
      return false;
    }
    return true;
  };

  const validateEmergencyContact = () => {
    if (!formData.emergencyContactName.trim()) {
      Alert.alert('Required', 'Please enter emergency contact name');
      return false;
    }
    if (!formData.emergencyContactPhone.trim()) {
      Alert.alert('Required', 'Please enter emergency contact phone');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 'basic') {
      if (validateBasicInfo()) setStep('medical');
    } else if (step === 'medical') {
      if (validateMedicalInfo()) setStep('emergency');
    } else if (step === 'emergency') {
      if (validateEmergencyContact()) handleSubmit();
    }
  };

  const handleBack = () => {
    if (step === 'medical') setStep('basic');
    else if (step === 'emergency') setStep('medical');
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Parse allergies and comorbidities as arrays
      const allergies = formData.allergies
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);
      
      const comorbidities = formData.comorbidities
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      await patientService.createPatient({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dateOfBirth: formData.dateOfBirth.toISOString().split('T')[0],
        gender: formData.gender as 'male' | 'female' | 'other',
        bloodGroup: formData.bloodGroup || undefined,
        cancerType: formData.cancerType,
        cancerStage: formData.cancerStage || undefined,
        diagnosisDate: formData.diagnosisDate.toISOString().split('T')[0],
        allergies,
        comorbidities,
        emergencyContactName: formData.emergencyContactName.trim(),
        emergencyContactPhone: formData.emergencyContactPhone.trim(),
        emergencyContactRelation: formData.emergencyContactRelation.trim() || undefined,
        heightCm: formData.heightCm ? parseFloat(formData.heightCm) : undefined,
        weightKg: formData.weightKg ? parseFloat(formData.weightKg) : undefined,
      });

      setStep('complete');
      
      // Refresh patient data
      await fetchCurrentPatient();
      
      // Navigate to home after a brief delay
      setTimeout(() => {
        router.replace('/(patient)/home');
      }, 2000);
      
    } catch (error: any) {
      console.error('Onboarding error:', error);
      
      // If profile already exists, just go to home
      if (error.response?.status === 400 && error.response?.data?.detail?.includes('already exists')) {
        router.replace('/(patient)/home');
        return;
      }
      
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to create profile. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStepNumber = () => {
    switch (step) {
      case 'basic': return 1;
      case 'medical': return 2;
      case 'emergency': return 3;
      case 'complete': return 4;
    }
  };

  if (step === 'complete') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.completeContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={colors.success} />
          </View>
          <Text style={styles.completeTitle}>Welcome to ChemoCare!</Text>
          <Text style={styles.completeSubtitle}>
            Your profile has been created successfully. We're here to support you through your treatment journey.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Complete Your Profile</Text>
        <Text style={styles.headerSubtitle}>Step {getStepNumber()} of 3</Text>
        
        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(getStepNumber() / 3) * 100}%` }]} />
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Basic Info */}
        {step === 'basic' && (
          <Card variant="default" padding="large">
            <View style={styles.stepHeader}>
              <Ionicons name="person" size={24} color={colors.primary[500]} />
              <Text style={styles.stepTitle}>Basic Information</Text>
            </View>

            <Input
              label="First Name"
              placeholder="Enter your first name"
              value={formData.firstName}
              onChangeText={(v) => updateForm('firstName', v)}
              autoCapitalize="words"
            />

            <Input
              label="Last Name"
              placeholder="Enter your last name"
              value={formData.lastName}
              onChangeText={(v) => updateForm('lastName', v)}
              autoCapitalize="words"
            />

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Date of Birth</Text>
              <Button
                title={formatDate(formData.dateOfBirth)}
                variant="outline"
                onPress={() => setShowDatePicker(true)}
                style={styles.dateButton}
              />
              {showDatePicker && (
                <DateTimePicker
                  value={formData.dateOfBirth}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    setShowDatePicker(false);
                    if (date) updateForm('dateOfBirth', date);
                  }}
                />
              )}
            </View>

            <Select
              label="Gender"
              placeholder="Select gender"
              options={GENDER_OPTIONS}
              value={formData.gender}
              onValueChange={(v) => updateForm('gender', v)}
            />

            <Select
              label="Blood Group"
              placeholder="Select blood group (optional)"
              options={BLOOD_GROUP_OPTIONS}
              value={formData.bloodGroup}
              onValueChange={(v) => updateForm('bloodGroup', v)}
            />

            <View style={styles.physicalRow}>
              <View style={styles.halfInput}>
                <Input
                  label="Height (cm)"
                  placeholder="e.g., 170"
                  value={formData.heightCm}
                  onChangeText={(v) => updateForm('heightCm', v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfInput}>
                <Input
                  label="Weight (kg)"
                  placeholder="e.g., 65"
                  value={formData.weightKg}
                  onChangeText={(v) => updateForm('weightKg', v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </Card>
        )}

        {/* Step 2: Medical Info */}
        {step === 'medical' && (
          <Card variant="default" padding="large">
            <View style={styles.stepHeader}>
              <Ionicons name="medical" size={24} color={colors.primary[500]} />
              <Text style={styles.stepTitle}>Medical Information</Text>
            </View>

            <Select
              label="Cancer Type"
              placeholder="Select your diagnosis"
              options={CANCER_TYPE_OPTIONS}
              value={formData.cancerType}
              onValueChange={(v) => updateForm('cancerType', v)}
            />

            <Select
              label="Cancer Stage"
              placeholder="Select stage (if known)"
              options={CANCER_STAGE_OPTIONS}
              value={formData.cancerStage}
              onValueChange={(v) => updateForm('cancerStage', v)}
            />

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Diagnosis Date (Approximate)</Text>
              <Button
                title={formatDate(formData.diagnosisDate)}
                variant="outline"
                onPress={() => setShowDatePicker(true)}
                style={styles.dateButton}
              />
              {showDatePicker && (
                <DateTimePicker
                  value={formData.diagnosisDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    setShowDatePicker(false);
                    if (date) updateForm('diagnosisDate', date);
                  }}
                />
              )}
            </View>

            <Input
              label="Known Allergies"
              placeholder="e.g., Penicillin, Sulfa (comma separated)"
              value={formData.allergies}
              onChangeText={(v) => updateForm('allergies', v)}
              multiline
            />

            <Input
              label="Other Medical Conditions"
              placeholder="e.g., Diabetes, Hypertension (comma separated)"
              value={formData.comorbidities}
              onChangeText={(v) => updateForm('comorbidities', v)}
              multiline
            />
          </Card>
        )}

        {/* Step 3: Emergency Contact */}
        {step === 'emergency' && (
          <Card variant="default" padding="large">
            <View style={styles.stepHeader}>
              <Ionicons name="call" size={24} color={colors.primary[500]} />
              <Text style={styles.stepTitle}>Emergency Contact</Text>
            </View>

            <Text style={styles.stepDescription}>
              Please provide details of someone we can contact in case of an emergency.
            </Text>

            <Input
              label="Contact Name"
              placeholder="Enter full name"
              value={formData.emergencyContactName}
              onChangeText={(v) => updateForm('emergencyContactName', v)}
              autoCapitalize="words"
            />

            <Input
              label="Contact Phone"
              placeholder="Enter phone number"
              value={formData.emergencyContactPhone}
              onChangeText={(v) => updateForm('emergencyContactPhone', v)}
              keyboardType="phone-pad"
            />

            <Input
              label="Relationship"
              placeholder="e.g., Spouse, Parent, Sibling"
              value={formData.emergencyContactRelation}
              onChangeText={(v) => updateForm('emergencyContactRelation', v)}
              autoCapitalize="words"
            />
          </Card>
        )}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {step !== 'basic' && (
          <Button
            title="Back"
            variant="outline"
            onPress={handleBack}
            style={styles.backButton}
          />
        )}
        <Button
          title={step === 'emergency' ? 'Complete Profile' : 'Continue'}
          variant="primary"
          onPress={handleNext}
          loading={isLoading}
          style={styles.nextButton}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.primary[500],
  },
  headerTitle: {
    fontSize: typography.title2.fontSize,
    fontWeight: typography.title2.fontWeight as TextStyle['fontWeight'],
    color: colors.neutral[0],
  },
  headerSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.primary[100],
    marginTop: spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.primary[300],
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.full,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  stepDescription: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.callout.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  dateButton: {
    justifyContent: 'flex-start',
  },
  physicalRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.border.medium,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  completeTitle: {
    fontSize: typography.title1.fontSize,
    fontWeight: typography.title1.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  completeSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
