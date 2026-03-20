/**
 * Doctor OPD Protocols - SOPHIA NHS protocol reference library
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Badge, Header } from '../../src/components';
import {
  getSophiaProtocols,
  getSophiaProtocolDetail,
  SophiaProtocol,
} from '../../src/services/protocolService';

interface ProtocolDetail {
  protocolName?: string;
  fullName?: string;
  indication?: string;
  cycleLengthDays?: number;
  totalCycles?: number;
  treatmentIntent?: string;
  source?: string;
  referenceUrl?: string;
  drugs?: Array<{ drugName: string; dose: number; doseUnit: string; route: string; days: number[] }>;
  preMedications?: Array<{ drugName: string; dose: number; doseUnit: string; route: string; timing?: string }>;
  takeHomeMedicines?: Array<{ drugName: string; dose: number; doseUnit: string; frequency?: string }>;
  doseModifications?: Array<{ description: string; actionText: string; affectedDrugs: string[] }>;
  warnings?: string[];
}

export default function DoctorOPDProtocolsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [protocols, setProtocols] = useState<SophiaProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedProtocol, setExpandedProtocol] = useState<string | null>(null);
  const [protocolDetail, setProtocolDetail] = useState<ProtocolDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchProtocols();
  }, []);

  const fetchProtocols = async () => {
    try {
      setIsLoading(true);
      const data = await getSophiaProtocols();
      setProtocols(data);
    } catch {
      setProtocols([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProtocolPress = useCallback(async (protocol: SophiaProtocol) => {
    if (expandedProtocol === protocol.code) {
      setExpandedProtocol(null);
      setProtocolDetail(null);
      return;
    }

    setExpandedProtocol(protocol.code);
    setLoadingDetail(true);
    try {
      const detail = await getSophiaProtocolDetail(protocol.code);
      setProtocolDetail(detail as ProtocolDetail);
    } catch {
      setProtocolDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [expandedProtocol]);

  const openReferenceUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const getSourceBadgeVariant = (source?: string): 'success' | 'info' | 'neutral' => {
    if (!source) return 'neutral';
    if (source.includes('NICE')) return 'info';
    if (source.includes('NHS')) return 'success';
    return 'neutral';
  };

  const filteredProtocols = protocols.filter(protocol => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return protocol.name.toLowerCase().includes(searchLower) ||
           protocol.indication.toLowerCase().includes(searchLower) ||
           protocol.drugs.some(d => d.toLowerCase().includes(searchLower)) ||
           protocol.code.toLowerCase().includes(searchLower);
  });

  const renderDrugList = (
    drugs: Array<{ drugName: string; dose?: number; doseUnit?: string; route?: string; days?: number[] }>,
    title: string,
    icon: string,
    color: string,
  ) => {
    if (!drugs || drugs.length === 0) return null;
    return (
      <View style={styles.detailSection}>
        <View style={styles.detailSectionHeader}>
          <Ionicons name={icon as any} size={16} color={color} />
          <Text style={[styles.detailSectionTitle, { color }]}>{title}</Text>
        </View>
        {drugs.map((drug, idx) => (
          <View key={idx} style={styles.drugItem}>
            <Text style={styles.drugName}>{drug.drugName}</Text>
            {drug.dose != null && drug.doseUnit && (
              <Text style={styles.drugDose}>
                {drug.dose} {drug.doseUnit} {drug.route ? `(${drug.route})` : ''}
              </Text>
            )}
            {drug.days && drug.days.length > 0 && (
              <Text style={styles.drugDays}>
                Days: {drug.days.join(', ')}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header
        title="SOPHIA Protocols"
        showBackButton
        onBackPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>NHS Protocol Reference Library</Text>
        <Text style={styles.sectionSubtitle}>
          {protocols.length} evidence-based chemotherapy protocols
        </Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading SOPHIA protocols...</Text>
          </View>
        ) : filteredProtocols.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No protocols match your search' : 'No protocols available'}
            </Text>
          </View>
        ) : (
          filteredProtocols.map((protocol) => {
            const isExpanded = expandedProtocol === protocol.code;
            return (
              <TouchableOpacity
                key={protocol.code}
                style={[styles.protocolCard, isExpanded && styles.protocolCardExpanded]}
                onPress={() => handleProtocolPress(protocol)}
                activeOpacity={0.7}
              >
                {/* Header */}
                <View style={styles.protocolHeader}>
                  <View style={styles.protocolTitleRow}>
                    <Text style={styles.protocolName}>{protocol.name}</Text>
                    <View style={styles.badgeRow}>
                      {protocol.source && (
                        <Badge
                          label={protocol.source}
                          variant={getSourceBadgeVariant(protocol.source)}
                          size="small"
                        />
                      )}
                    </View>
                  </View>
                  <Text style={styles.protocolIndication} numberOfLines={isExpanded ? undefined : 2}>
                    {protocol.indication}
                  </Text>
                </View>

                {/* Meta */}
                <View style={styles.protocolMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="repeat-outline" size={16} color={Colors.primary} />
                    <Text style={styles.metaText}>{protocol.totalCycles} cycles</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.metaText}>Every {protocol.cycleLengthDays} days</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="flask-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.metaText}>{protocol.drugs.length} drugs</Text>
                  </View>
                </View>

                {/* Drug badges */}
                <View style={styles.drugsContainer}>
                  {protocol.drugs.map((drug, idx) => (
                    <Badge key={idx} label={drug} variant="neutral" size="small" />
                  ))}
                </View>

                {/* NHS Reference button */}
                {protocol.referenceUrl && (
                  <TouchableOpacity
                    style={styles.referenceButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      openReferenceUrl(protocol.referenceUrl!);
                    }}
                  >
                    <Ionicons name="open-outline" size={14} color={Colors.primary} />
                    <Text style={styles.referenceButtonText}>View NHS Reference</Text>
                  </TouchableOpacity>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <View style={styles.expandedDetail}>
                    {loadingDetail ? (
                      <View style={styles.detailLoading}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={styles.detailLoadingText}>Loading protocol details...</Text>
                      </View>
                    ) : protocolDetail ? (
                      <>
                        {/* Treatment intent */}
                        {protocolDetail.treatmentIntent && (
                          <View style={styles.intentRow}>
                            <Text style={styles.intentLabel}>Intent:</Text>
                            <Badge
                              label={protocolDetail.treatmentIntent}
                              variant={protocolDetail.treatmentIntent === 'curative' ? 'success' : 'warning'}
                              size="small"
                            />
                          </View>
                        )}

                        {/* Core drugs */}
                        {renderDrugList(
                          protocolDetail.drugs || [],
                          'Core Drugs',
                          'medkit-outline',
                          Colors.primary,
                        )}

                        {/* Pre-medications */}
                        {renderDrugList(
                          protocolDetail.preMedications || [],
                          'Pre-Medications',
                          'shield-outline',
                          '#2196F3',
                        )}

                        {/* Take-home medicines */}
                        {renderDrugList(
                          protocolDetail.takeHomeMedicines || [],
                          'Take-Home Medicines',
                          'home-outline',
                          '#4CAF50',
                        )}

                        {/* Dose modifications */}
                        {protocolDetail.doseModifications && protocolDetail.doseModifications.length > 0 && (
                          <View style={styles.detailSection}>
                            <View style={styles.detailSectionHeader}>
                              <Ionicons name="warning-outline" size={16} color="#FF9800" />
                              <Text style={[styles.detailSectionTitle, { color: '#FF9800' }]}>
                                Dose Modification Rules ({protocolDetail.doseModifications.length})
                              </Text>
                            </View>
                            {protocolDetail.doseModifications.slice(0, 5).map((mod, idx) => (
                              <View key={idx} style={styles.modificationItem}>
                                <Text style={styles.modificationText}>{mod.actionText || mod.description}</Text>
                                {mod.affectedDrugs && mod.affectedDrugs.length > 0 && (
                                  <Text style={styles.modificationDrugs}>
                                    Affects: {mod.affectedDrugs.join(', ')}
                                  </Text>
                                )}
                              </View>
                            ))}
                            {protocolDetail.doseModifications.length > 5 && (
                              <Text style={styles.moreText}>
                                +{protocolDetail.doseModifications.length - 5} more rules
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Warnings */}
                        {protocolDetail.warnings && protocolDetail.warnings.length > 0 && (
                          <View style={styles.detailSection}>
                            <View style={styles.detailSectionHeader}>
                              <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
                              <Text style={[styles.detailSectionTitle, { color: '#F44336' }]}>
                                Warnings ({protocolDetail.warnings.length})
                              </Text>
                            </View>
                            {protocolDetail.warnings.slice(0, 3).map((warning, idx) => (
                              <Text key={idx} style={styles.warningText}>{warning}</Text>
                            ))}
                            {protocolDetail.warnings.length > 3 && (
                              <Text style={styles.moreText}>
                                +{protocolDetail.warnings.length - 3} more warnings
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Actions */}
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => router.push('/(doctor-opd)/ai')}
                          >
                            <Ionicons name="sparkles" size={16} color={Colors.white} />
                            <Text style={styles.actionButtonText}>Ask AI About This</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.detailErrorText}>Failed to load protocol details</Text>
                    )}
                  </View>
                )}

                {/* Expand indicator */}
                <View style={styles.expandIndicator}>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>
            );
          })
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
  sectionTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  protocolCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  protocolCardExpanded: {
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  protocolHeader: {
    marginBottom: Spacing.sm,
  },
  protocolTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  protocolName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  protocolIndication: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
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
  referenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight || '#E3F2FD',
    alignSelf: 'flex-start',
  },
  referenceButtonText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  expandedDetail: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  detailLoadingText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  detailErrorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  intentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  intentLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  detailSection: {
    marginBottom: Spacing.md,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  detailSectionTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
  },
  drugItem: {
    paddingVertical: 4,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    marginBottom: 4,
  },
  drugName: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  drugDose: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  drugDays: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  modificationItem: {
    paddingVertical: 4,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: '#FF9800',
    marginBottom: 4,
  },
  modificationText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  modificationDrugs: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  warningText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: '#D32F2F',
    lineHeight: 16,
    paddingLeft: Spacing.md,
    marginBottom: 4,
  },
  moreText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    paddingLeft: Spacing.md,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
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
