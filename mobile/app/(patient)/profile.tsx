/**
 * Patient Profile Screen - Account settings and information
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ViewStyle,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Avatar, Header, Modal, Button } from '../../src/components';
import { useAuthStore } from '../../src/store/authStore';
import { usePatientStore } from '../../src/store/patientStore';

export default function PatientProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { currentPatient, treatmentPlans } = usePatientStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace('/(auth)/login');
  };

  // Calculate real stats
  const completedCycles = treatmentPlans?.reduce((sum, plan) => sum + plan.completedCycles, 0) || 0;
  const totalAppointments = treatmentPlans?.length || 0;
  const monthsInTreatment = currentPatient?.diagnosisDate 
    ? Math.max(1, Math.floor((Date.now() - new Date(currentPatient.diagnosisDate).getTime()) / (30 * 24 * 60 * 60 * 1000)))
    : 0;

  const menuSections = [
    {
      title: 'My Health',
      items: [
        {
          icon: 'medical-outline',
          label: 'Take-home Medications',
          onPress: () => router.push('/(patient)/medications'),
        },
        {
          icon: 'flask-outline',
          label: 'Lab Results',
          onPress: () => router.push('/(patient)/labs'),
        },
        {
          icon: 'cash-outline',
          label: 'Treatment Costs',
          onPress: () => router.push('/(patient)/costs'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'chatbubble-ellipses-outline',
          label: 'Contact Support',
          onPress: () => Linking.openURL('tel:18002436226'),
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <Header title="Profile" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Card variant="elevated" padding="large" style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Avatar
              source={user?.avatar ? { uri: user.avatar } : undefined}
              name={user?.fullName || 'Patient'}
              size="xlarge"
            />
            <TouchableOpacity
            style={styles.editAvatarButton}
            onPress={() => {}}
            activeOpacity={0.7}
            accessibilityLabel="Change profile photo"
            accessibilityRole="button"
          >
              <Ionicons name="camera" size={16} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.profileName}>{user?.fullName || 'Loading...'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>

          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{completedCycles}</Text>
              <Text style={styles.statLabel}>Cycles</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalAppointments}</Text>
              <Text style={styles.statLabel}>Plans</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{monthsInTreatment}</Text>
              <Text style={styles.statLabel}>Months</Text>
            </View>
          </View>
        </Card>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Card variant="default" padding="none">
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    index < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.6}
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                >
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuIconContainer}>
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={colors.text.secondary}
                      />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.menuItemRight}>
                    {'value' in item && (item as any).value && (
                      <Text style={styles.menuValue}>{(item as any).value}</Text>
                    )}
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.text.tertiary}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setShowLogoutModal(true)}
          activeOpacity={0.6}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Sign Out"
        size="small"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalText}>
            Are you sure you want to sign out? You'll need to sign in again to access your account.
          </Text>
          <View style={styles.modalFooter}>
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setShowLogoutModal(false)}
            />
            <Button
              title="Sign Out"
              variant="danger"
              onPress={handleLogout}
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
    paddingBottom: spacing.xxxl,
  },
  profileCard: {
    alignItems: 'center',
    marginTop: spacing.md,
  } as ViewStyle,
  profileHeader: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.neutral[0],
  },
  profileName: {
    fontWeight: '700',
    fontSize: typography.title2.fontSize,
    color: colors.text.primary,
  },
  profileEmail: {
    fontWeight: '400',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: 2,
  },
  profileStats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
    fontSize: typography.title2.fontSize,
    color: colors.primary[500],
  },
  statLabel: {
    fontWeight: '400',
    fontSize: typography.caption2.fontSize,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.sm,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuLabel: {
    fontWeight: '500',
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  menuValue: {
    fontWeight: '400',
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
    minHeight: 48,
  },
  logoutText: {
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.error,
  },
  version: {
    fontWeight: '400',
    fontSize: typography.caption2.fontSize,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  modalContent: {
    gap: spacing.md,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalText: {
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
