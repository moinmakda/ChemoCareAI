/**
 * Doctor Clinical Notes Screen
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Header, Card, Badge, Button } from '../../src/components';
import { doctorService } from '../../src/services/doctorService';

export default function DoctorNotesScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('clinical');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!patientId) return;
    try {
      const data = await doctorService.getNotes(patientId);
      setNotes(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);
  const onRefresh = () => { setRefreshing(true); loadNotes(); };

  const handleSubmit = async () => {
    if (!noteContent.trim() || !patientId) return;
    setSubmitting(true);
    try {
      await doctorService.createNote({
        patientId,
        content: noteContent,
        noteType,
        isPrivate,
      });
      setShowModal(false);
      setNoteContent('');
      setIsPrivate(false);
      loadNotes();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create note.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (noteId: string) => {
    Alert.alert('Delete Note', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await doctorService.deleteNote(noteId);
            loadNotes();
          } catch {
            Alert.alert('Error', 'Could not delete note.');
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Clinical Notes" showBackButton onBackPress={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Clinical Notes" showBackButton onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {notes.length === 0 ? (
          <Card variant="default" padding="large" style={styles.card}>
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No clinical notes yet</Text>
            </View>
          </Card>
        ) : (
          notes.map(note => (
            <Card key={note.id} variant="default" padding="medium" style={styles.card}>
              <View style={styles.noteHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Badge label={note.noteType || 'clinical'} variant="info" size="small" />
                    {note.isPrivate && <Badge label="Private" variant="warning" size="small" />}
                  </View>
                  <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(note.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
              <Text style={styles.noteContent}>{note.content}</Text>
            </Card>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Note Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
            <View style={{ flex: 1 }} />
          </TouchableOpacity>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Clinical Note</Text>

            <View style={styles.typeRow}>
              {['clinical', 'assessment', 'plan', 'follow_up'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, noteType === type && styles.typeBtnActive]}
                  onPress={() => setNoteType(type)}
                >
                  <Text style={[styles.typeBtnText, noteType === type && styles.typeBtnTextActive]}>
                    {type.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.textArea}
              value={noteContent}
              onChangeText={setNoteContent}
              placeholder="Enter clinical notes..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.privateRow} onPress={() => setIsPrivate(!isPrivate)}>
              <View style={[styles.checkbox, isPrivate && styles.checkboxChecked]}>
                {isPrivate && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.privateLabel}>Private (not visible to nurses)</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowModal(false)} />
              <Button
                title={submitting ? 'Saving...' : 'Save Note'}
                variant="primary"
                onPress={handleSubmit}
                disabled={!noteContent.trim() || submitting}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
  card: { marginBottom: Spacing.sm },
  noteHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  noteDate: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, color: Colors.textTertiary, marginTop: 4 },
  noteContent: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  emptyText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md, color: Colors.textSecondary, marginTop: Spacing.md },
  fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '80%' },
  modalTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg, color: Colors.textPrimary, marginBottom: Spacing.md },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  typeBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  typeBtnTextActive: { color: Colors.white },
  textArea: { backgroundColor: Colors.backgroundTertiary, borderRadius: BorderRadius.md, padding: Spacing.md, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: Colors.textPrimary, minHeight: 120, marginBottom: Spacing.md },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  privateLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, color: Colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
