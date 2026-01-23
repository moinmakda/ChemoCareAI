/**
 * Nurse Profile Screen - Account settings and information
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/constants/theme';
import { Card, Avatar, Header, Modal, Button } from '../../src/components';
import { useAuthStore } from '../../src/store/authStore';

export default function NurseProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const menuSections = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Personal Information', onPress: () => {} },
        { icon: 'medical-outline', label: 'Nursing License', onPress: () => {} },
        { icon: 'calendar-outline', label: 'Shift Schedule', onPress: () => {} },
      ],
    },
    {
      title: 'Work Settings',
      items: [
        { icon: 'bed-outline', label: 'Assigned Chairs', onPress: () => {} },
        { icon: 'clipboard-outline', label: 'Task Preferences', onPress: () => {} },
        { icon: 'alert-circle-outline', label: 'Alert Settings', onPress: () => {} },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: 'notifications-outline', label: 'Notifications', onPress: () => {} },
        { icon: 'language-outline', label: 'Language', value: 'English', onPress: () => {} },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help Center', onPress: () => {} },
        { icon: 'chatbubble-ellipses-outline', label: 'Contact Support', onPress: () => {} },
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
              name={user?.fullName || 'Nurse'}
              size="xlarge"
            />
            <TouchableOpacity style={styles.editAvatarButton}>
              <Ionicons name="camera" size={16} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.profileName}>{user?.fullName || 'Nurse Name'}</Text>
          <Text style={styles.profileRole}>Oncology Nurse</Text>
          <Text style={styles.profileEmail}>{user?.email || 'email@example.com'}</Text>

          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>8</Text>
              <Text style={styles.statLabel}>Patients Today</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>42</Text>
              <Text style={styles.statLabel}>This Week</Text>
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
                >
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuIconContainer}>
                      <Ionicons name={item.icon as any} size={20} color={colors.text.secondary} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.menuItemRight}>
                    {'value' in item && <Text style={styles.menuValue}>{item.value}</Text>}
                    <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
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
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      {/* Logout Modal */}
      <Modal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Sign Out"
        size="small"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalText}>
            Are you sure you want to sign out?
          </Text>
          <View style={styles.modalFooter}>
            <Button title="Cancel" variant="ghost" onPress={() => setShowLogoutModal(false)} />
            <Button title="Sign Out" variant="danger" onPress={handleLogout} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  profileCard: { alignItems: 'center', marginTop: spacing.md } as ViewStyle,
  profileHeader: { position: 'relative', marginBottom: spacing.md },
  editAvatarButton: {
    position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary[500], alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.neutral[0],
  },
  profileName: { fontWeight: '700', fontSize: typography.title2.fontSize, color: colors.text.primary },
  profileRole: { fontWeight: '500', fontSize: typography.caption1.fontSize, color: colors.primary[500], marginTop: 2 },
  profileEmail: { fontWeight: '400', fontSize: typography.caption1.fontSize, color: colors.text.secondary, marginTop: 2 },
  profileStats: { flexDirection: 'row', marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border.light },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontWeight: '700', fontSize: typography.title2.fontSize, color: colors.primary[500] },
  statLabel: { fontWeight: '400', fontSize: 11, color: colors.text.secondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border.light, marginHorizontal: spacing.sm },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontWeight: '600', fontSize: typography.caption1.fontSize, color: colors.text.secondary, marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border.light },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconContainer: { width: 36, height: 36, borderRadius: borderRadius.md, backgroundColor: colors.background.secondary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  menuLabel: { fontWeight: '500', fontSize: typography.body.fontSize, color: colors.text.primary },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  menuValue: { fontWeight: '400', fontSize: typography.caption1.fontSize, color: colors.text.secondary },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, marginTop: spacing.xl, gap: spacing.sm },
  logoutText: { fontWeight: '600', fontSize: typography.body.fontSize, color: colors.error },
  version: { fontWeight: '400', fontSize: 11, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.lg },
  modalContent: { gap: spacing.md },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  modalText: { fontWeight: '400', fontSize: typography.body.fontSize, color: colors.text.secondary, textAlign: 'center' },
});
