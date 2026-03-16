/**
 * Doctor OPD Protocols - AI-powered treatment protocol management
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Card, Badge, Button, Header } from '../../src/components';
import { treatmentService } from '../../src/services';

interface ProtocolDisplay {
  id: string;
  name: string;
  fullName: string;
  indication: string;
  cycles: string;
  frequency: string;
  drugs: string[];
  popularity: 'high' | 'medium' | 'low';
}

export default function DoctorOPDProtocolsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [protocols, setProtocols] = useState<ProtocolDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProtocols();
  }, []);

  const fetchProtocols = async () => {
    try {
      setIsLoading(true);
      const data = await treatmentService.listProtocols();
      
      // Map API response to display format (all fields camelCase from interceptor)
      const mappedProtocols: ProtocolDisplay[] = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        fullName: p.fullName || p.name,
        indication: Array.isArray(p.cancerTypes) ? p.cancerTypes.join(', ') : 'General',
        cycles: `${p.totalCycles ?? 6} cycles`,
        frequency: `Every ${p.cycleDays ?? 21} days`,
        drugs: (p.drugs || []).map((d: any) => d.name || d.drugName).slice(0, 5),
        popularity: (p.drugs?.length >= 4 ? 'high' : 'medium') as 'high' | 'medium' | 'low',
      }));
      
      setProtocols(mappedProtocols);
    } catch {
      // Fallback to empty - show message
      setProtocols([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProtocols = protocols.filter(protocol => {
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
            onPress={() => router.push('/(doctor-daycare)/ai')}
            icon={<Ionicons name="chatbubbles-outline" size={18} color={Colors.white} />}
          />
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(doctor-opd)/protocols')}>
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>New Protocol</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(doctor-opd)/protocols')}>
            <View style={[styles.quickActionIcon, { backgroundColor: `${Colors.success}20` }]}>
              <Ionicons name="calculator-outline" size={24} color={Colors.success} />
            </View>
            <Text style={styles.quickActionText}>Dose Calculator</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(doctor-opd)/protocols')}>
            <View style={[styles.quickActionIcon, { backgroundColor: `${Colors.warning}20` }]}>
              <Ionicons name="alert-circle-outline" size={24} color={Colors.warning} />
            </View>
            <Text style={styles.quickActionText}>Drug Interactions</Text>
          </TouchableOpacity>
        </View>

        {/* Protocol List */}
        <Text style={styles.sectionTitle}>Standard Protocols</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading protocols...</Text>
          </View>
        ) : filteredProtocols.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No protocols match your search' : 'No protocols available'}
            </Text>
          </View>
        ) : (
          filteredProtocols.map((protocol) => (
            <TouchableOpacity key={protocol.id} style={styles.protocolCard} onPress={() => router.push('/(doctor-daycare)/ai')}>
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
          ))
        )}
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
