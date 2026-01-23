/**
 * Doctor OPD Protocols - AI-powered treatment protocol management
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Card, Badge, Button, Header } from '../../src/components';

// Common chemotherapy protocols
const PROTOCOLS = [
  {
    id: '1',
    name: 'FOLFOX',
    fullName: 'Folinic acid, Fluorouracil, Oxaliplatin',
    indication: 'Colorectal Cancer',
    cycles: '12 cycles (6 months)',
    frequency: 'Every 2 weeks',
    drugs: ['Oxaliplatin', '5-Fluorouracil', 'Leucovorin'],
    popularity: 'high',
  },
  {
    id: '2',
    name: 'AC-T',
    fullName: 'Doxorubicin, Cyclophosphamide, Paclitaxel',
    indication: 'Breast Cancer',
    cycles: '8 cycles (4+4)',
    frequency: 'Every 2-3 weeks',
    drugs: ['Doxorubicin', 'Cyclophosphamide', 'Paclitaxel'],
    popularity: 'high',
  },
  {
    id: '3',
    name: 'CHOP',
    fullName: 'Cyclophosphamide, Doxorubicin, Vincristine, Prednisone',
    indication: 'Non-Hodgkin Lymphoma',
    cycles: '6-8 cycles',
    frequency: 'Every 3 weeks',
    drugs: ['Cyclophosphamide', 'Doxorubicin', 'Vincristine', 'Prednisone'],
    popularity: 'high',
  },
  {
    id: '4',
    name: 'Cisplatin + Etoposide',
    fullName: 'Platinum-based regimen',
    indication: 'Lung Cancer (SCLC)',
    cycles: '4-6 cycles',
    frequency: 'Every 3 weeks',
    drugs: ['Cisplatin', 'Etoposide'],
    popularity: 'medium',
  },
  {
    id: '5',
    name: 'R-CHOP',
    fullName: 'Rituximab + CHOP',
    indication: 'B-cell Lymphoma',
    cycles: '6-8 cycles',
    frequency: 'Every 3 weeks',
    drugs: ['Rituximab', 'Cyclophosphamide', 'Doxorubicin', 'Vincristine', 'Prednisone'],
    popularity: 'high',
  },
  {
    id: '6',
    name: 'Gemcitabine + Carboplatin',
    fullName: 'GemCarbo',
    indication: 'Ovarian/Bladder Cancer',
    cycles: '6 cycles',
    frequency: 'Every 3 weeks',
    drugs: ['Gemcitabine', 'Carboplatin'],
    popularity: 'medium',
  },
];

export default function DoctorOPDProtocolsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProtocols = PROTOCOLS.filter(protocol => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return protocol.name.toLowerCase().includes(searchLower) ||
           protocol.indication.toLowerCase().includes(searchLower) ||
           protocol.drugs.some(d => d.toLowerCase().includes(searchLower));
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header 
        title="Treatment Protocols" 
        showBackButton 
        onBackPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Assistant Card */}
        <Card variant="filled" padding="medium" style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={24} color={Colors.primary} />
            </View>
            <View style={styles.aiContent}>
              <Text style={styles.aiTitle}>AI Protocol Assistant</Text>
              <Text style={styles.aiDescription}>
                Get personalized protocol recommendations based on patient data
              </Text>
            </View>
          </View>
          <Button 
            title="Ask AI for Recommendations" 
            variant="primary" 
            onPress={() => {}}
            icon={<Ionicons name="chatbubbles-outline" size={18} color={Colors.white} />}
          />
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>New Protocol</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: `${Colors.success}20` }]}>
              <Ionicons name="calculator-outline" size={24} color={Colors.success} />
            </View>
            <Text style={styles.quickActionText}>Dose Calculator</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: `${Colors.warning}20` }]}>
              <Ionicons name="alert-circle-outline" size={24} color={Colors.warning} />
            </View>
            <Text style={styles.quickActionText}>Drug Interactions</Text>
          </TouchableOpacity>
        </View>

        {/* Protocol List */}
        <Text style={styles.sectionTitle}>Standard Protocols</Text>
        
        {filteredProtocols.map((protocol) => (
          <TouchableOpacity key={protocol.id} style={styles.protocolCard}>
            <View style={styles.protocolHeader}>
              <View style={styles.protocolTitleRow}>
                <Text style={styles.protocolName}>{protocol.name}</Text>
                {protocol.popularity === 'high' && (
                  <Badge label="Popular" variant="success" size="small" />
                )}
              </View>
              <Text style={styles.protocolFullName}>{protocol.fullName}</Text>
            </View>
            
            <View style={styles.protocolMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="medical-outline" size={16} color={Colors.primary} />
                <Text style={styles.metaText}>{protocol.indication}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="repeat-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{protocol.cycles}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{protocol.frequency}</Text>
              </View>
            </View>

            <View style={styles.drugsContainer}>
              {protocol.drugs.map((drug, idx) => (
                <Badge key={idx} label={drug} variant="neutral" size="small" />
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  aiCard: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  aiContent: {
    flex: 1,
  },
  aiTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  aiDescription: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.xs,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  quickActionText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  protocolCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  protocolHeader: {
    marginBottom: Spacing.sm,
  },
  protocolTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  protocolName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  protocolFullName: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  protocolMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  drugsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
});
