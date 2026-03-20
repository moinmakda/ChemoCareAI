/**
 * Doctor Patient Photos Screen
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Header, Card, Badge } from '../../src/components';
import { photoService, PhotoRecord } from '../../src/services/photoService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 2) / 3;

const CATEGORIES = ['all', 'port_site', 'skin_reaction', 'wound', 'other'];

export default function PatientPhotosScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const loadPhotos = useCallback(async () => {
    if (!patientId) return;
    try {
      const category = selectedCategory === 'all' ? undefined : selectedCategory;
      const data = await photoService.listPhotos(patientId, category);
      setPhotos(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId, selectedCategory]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);
  const onRefresh = () => { setRefreshing(true); loadPhotos(); };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Patient Photos" showBackButton onBackPress={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Patient Photos" showBackButton onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterBtn, selectedCategory === cat && styles.filterBtnActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterBtnText, selectedCategory === cat && styles.filterBtnTextActive]}>
                {cat === 'all' ? 'All' : cat.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Photo Grid */}
        {photos.length === 0 ? (
          <Card variant="default" padding="large" style={styles.emptyCard}>
            <Ionicons name="camera-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No photos found</Text>
          </Card>
        ) : (
          <View style={styles.grid}>
            {photos.map(photo => (
              <View key={photo.id} style={styles.photoCard}>
                <Image
                  source={{ uri: photo.fileUrl }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoCategory} numberOfLines={1}>
                    {photo.category.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.photoDate}>{formatDate(photo.uploadedAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: { marginBottom: Spacing.md },
  filterBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.xs, backgroundColor: Colors.white },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBtnText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  filterBtnTextActive: { color: Colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoCard: { width: PHOTO_SIZE, borderRadius: BorderRadius.md, overflow: 'hidden', backgroundColor: Colors.white, ...Shadows.small },
  photoImage: { width: PHOTO_SIZE, height: PHOTO_SIZE },
  photoInfo: { padding: 6 },
  photoCategory: { fontFamily: Typography.fontFamily.medium, fontSize: 10, color: Colors.textPrimary, textTransform: 'capitalize' },
  photoDate: { fontFamily: Typography.fontFamily.regular, fontSize: 9, color: Colors.textTertiary },
  emptyCard: { alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md, color: Colors.textSecondary },
});
