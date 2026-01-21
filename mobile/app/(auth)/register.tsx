/**
 * Register Screen - New user registration
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextStyle,
  ViewStyle,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Button, Input, Card, Header } from '../../src/components';
import { useAuthStore } from '../../src/store/authStore';

type UserRole = 'patient' | 'doctor_opd' | 'doctor_daycare' | 'nurse';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [step, setStep] = useState(1);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState({ code: '+91', flag: '🇮🇳', name: 'India' });
  
  const countries = [
    { code: '+91', flag: '🇮🇳', name: 'India' },
    { code: '+1', flag: '🇺🇸', name: 'United States' },
    { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
    { code: '+971', flag: '🇦🇪', name: 'UAE' },
    { code: '+65', flag: '🇸🇬', name: 'Singapore' },
    { code: '+61', flag: '🇦🇺', name: 'Australia' },
    { code: '+49', flag: '🇩🇪', name: 'Germany' },
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+81', flag: '🇯🇵', name: 'Japan' },
    { code: '+86', flag: '🇨🇳', name: 'China' },
  ];
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    role: 'patient' as UserRole,
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.email.trim() || !formData.password.trim() || !formData.confirmPassword.trim()) {
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        return;
      }
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleRegister = async () => {
    clearError();

    try {
      await register({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        phone: formData.phone,
        role: formData.role,
      });
      router.replace('/');
    } catch (err) {
      // Error handled by store
    }
  };

  const roles: { key: UserRole; label: string; description: string }[] = [
    { key: 'patient', label: 'Patient', description: 'Access your treatment plans and appointments' },
    { key: 'doctor_opd', label: 'Doctor (OPD)', description: 'Manage patients and create protocols' },
    { key: 'doctor_daycare', label: 'Doctor (Day Care)', description: 'Manage day care treatments' },
    { key: 'nurse', label: 'Nurse', description: 'Monitor day care and administer treatments' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header title="Create Account" showBackButton onBackPress={handleBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {[1, 2].map((s) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                s === step && styles.progressDotActive,
                s < step && styles.progressDotComplete,
              ]}
            />
          ))}
        </View>

        {step === 1 && (
          <Card variant="elevated" padding="large" style={styles.formCard}>
            <Text style={styles.stepTitle}>Account Details</Text>
            <Text style={styles.stepSubtitle}>Create your login credentials</Text>

            <Input
              label="Email"
              placeholder="Enter your email"
              value={formData.email}
              onChangeText={(v: string) => updateField('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon="mail-outline"
              required
            />

            <Input
              label="Password"
              placeholder="Create a password"
              value={formData.password}
              onChangeText={(v: string) => updateField('password', v)}
              secureTextEntry
              leftIcon="lock-closed-outline"
              helperText="Minimum 8 characters"
              required
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(v: string) => updateField('confirmPassword', v)}
              secureTextEntry
              leftIcon="lock-closed-outline"
              error={
                formData.confirmPassword && formData.password !== formData.confirmPassword
                  ? "Passwords don't match"
                  : undefined
              }
              required
            />

            <Button
              title="Continue"
              onPress={handleNext}
              disabled={
                !formData.email.trim() ||
                !formData.password.trim() ||
                formData.password !== formData.confirmPassword
              }
              fullWidth
              style={styles.nextButton}
            />
          </Card>
        )}

        {step === 2 && (
          <Card variant="elevated" padding="large" style={styles.formCard}>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepSubtitle}>Tell us about yourself</Text>

            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={formData.full_name}
              onChangeText={(text) => updateField('full_name', text)}
              autoCapitalize="words"
              leftIcon="person-outline"
              required
            />

            <View style={styles.phoneInputContainer}>
              <Text style={styles.phoneLabel}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity 
                  style={styles.countrySelector}
                  onPress={() => setShowCountryPicker(true)}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.phone}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                  keyboardType="number-pad"
                  maxLength={10}
                  textContentType="none"
                  autoComplete="off"
                />
              </View>
            </View>

            <Text style={styles.roleLabel}>I am a...</Text>
            <View style={styles.roleContainer}>
              {roles.map((role) => (
                <TouchableOpacity
                  key={role.key}
                  style={[
                    styles.roleOption,
                    formData.role === role.key && styles.roleOptionSelected,
                  ]}
                  onPress={() => updateField('role', role.key)}
                >
                  <Text
                    style={[
                      styles.roleTitle,
                      formData.role === role.key && styles.roleTitleSelected,
                    ]}
                  >
                    {role.label}
                  </Text>
                  <Text style={styles.roleDescription}>{role.description}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={isLoading}
              disabled={!formData.full_name.trim() || !formData.phone.trim()}
              fullWidth
              style={styles.nextButton}
            />
          </Card>
        )}

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.code === item.code && styles.countryItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setShowCountryPicker(false);
                  }}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <Text style={styles.countryItemName}>{item.name}</Text>
                  <Text style={styles.countryItemCode}>{item.code}</Text>
                  {selectedCountry.code === item.code && (
                    <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.light,
  },
  progressDotActive: {
    backgroundColor: colors.primary[500],
    width: 24,
  },
  progressDotComplete: {
    backgroundColor: colors.success,
  },
  formCard: {
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.title2.fontSize,
    fontWeight: typography.title2.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  nextButton: {
    marginTop: spacing.md,
  },
  roleLabel: {
    fontSize: typography.callout.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  phoneInputContainer: {
    marginBottom: spacing.md,
  },
  phoneLabel: {
    fontSize: typography.callout.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[50],
    gap: spacing.xs,
    minHeight: 52,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    backgroundColor: colors.neutral[0],
    minHeight: 52,
  },
  roleContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  roleOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    backgroundColor: colors.neutral[0],
  },
  roleOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  roleTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  roleTitleSelected: {
    color: colors.primary[500],
  },
  roleDescription: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.callout.fontSize,
    fontWeight: '500',
    color: colors.error,
    textAlign: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  },
  loginLink: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.primary[500],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.title3.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  countryItemSelected: {
    backgroundColor: colors.primary[50],
  },
  countryItemFlag: {
    fontSize: 24,
  },
  countryItemName: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
  },
  countryItemCode: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
});
