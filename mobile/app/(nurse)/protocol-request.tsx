/**
 * Nurse Protocol Request Screen
 * Create new protocol request, upload documents, collect clinical data
 * AI extracts data from documents using Gemini Vision
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  TextStyle,
  Platform,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/constants/theme';
import { Card, Header, Button, Input, Badge, Modal } from '../../src/components';
import {
  createProtocolRequest,
  uploadDocumentWithExtraction,
  updateClinicalData,
  nurseSubmitForReview,
  getProtocolRequest,
  ProtocolRequest,
  DocumentUploadResponse,
  ClinicalDataCollection,
} from '../../src/services/protocolService';
import { patientService } from '../../src/services';

interface ExtractedDocument {
  id: number;
  type: string;
  filename: string;
  imageUri: string;
  extractedData?: Record<string, any>;
  confidence: number;
  needsVerification: boolean;
}

interface PatientListItem {
  id: string;
  firstName: string;
  lastName: string;
  cancerType?: string;
  cancerStage?: string;
}

export default function NurseProtocolRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string; requestId?: string }>();
  
  const [isLoading, setIsLoading] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [protocolRequest, setProtocolRequest] = useState<ProtocolRequest | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<ExtractedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ExtractedDocument | null>(null);
  
  // Patient selection state
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientListItem[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);
  
  // Clinical data form
  const [clinicalData, setClinicalData] = useState<Partial<ClinicalDataCollection>>({
    height_cm: undefined,
    weight_kg: undefined,
    cancer_type: '',
    disease_stage: '',
    current_symptoms: [],
    performance_status: '',
  });
  
  const [nurseNotes, setNurseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing request or patient data
  useEffect(() => {
    loadData();
    loadAllPatients();
  }, [params.patientId, params.requestId]);

  const loadAllPatients = async () => {
    setLoadingPatients(true);
    try {
      const patients = await patientService.listPatients();
      setAllPatients(patients);
    } catch {
      // silent — patient list stays empty
    } finally {
      setLoadingPatients(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (params.requestId) {
        // Load existing protocol request
        const request = await getProtocolRequest(params.requestId);
        setProtocolRequest(request);
        if (request.clinical_data) {
          setClinicalData(request.clinical_data);
        }
        // Load patient
        const patientData = await patientService.getPatient(request.patient_id);
        setPatient(patientData);
      } else if (params.patientId) {
        // Load patient for new request
        const patientData = await patientService.getPatient(params.patientId);
        setPatient(patientData);
        
        // Pre-fill from patient data
        setClinicalData(prev => ({
          ...prev,
          height_cm: patientData.heightCm,
          weight_kg: patientData.weightKg,
          cancer_type: patientData.cancerType,
          disease_stage: patientData.cancerStage,
        }));
      }
    } catch {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const selectPatient = async (selectedPatient: PatientListItem) => {
    setShowPatientSelector(false);
    setIsLoading(true);
    try {
      const patientData = await patientService.getPatient(selectedPatient.id);
      setPatient(patientData);
      
      // Pre-fill from patient data
      setClinicalData(prev => ({
        ...prev,
        height_cm: patientData.heightCm,
        weight_kg: patientData.weightKg,
        cancer_type: patientData.cancerType,
        disease_stage: patientData.cancerStage,
      }));
    } catch {
      Alert.alert('Error', 'Failed to load patient data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = allPatients.filter(p => {
    const searchLower = patientSearchQuery.toLowerCase();
    return (
      p.firstName?.toLowerCase().includes(searchLower) ||
      p.lastName?.toLowerCase().includes(searchLower) ||
      p.cancerType?.toLowerCase().includes(searchLower)
    );
  });

  // Create protocol request if not exists
  const ensureProtocolRequest = async (): Promise<string | null> => {
    if (protocolRequest) {
      return protocolRequest.id;
    }
    
    if (!patient) {
      Alert.alert('Error', 'Patient not selected');
      return null;
    }
    
    try {
      const newRequest = await createProtocolRequest({
        patient_id: patient.id,
        notes: 'Protocol request initiated by nurse',
      });
      setProtocolRequest(newRequest);
      return newRequest.id;
    } catch {
      Alert.alert('Error', 'Failed to create protocol request');
      return null;
    }
  };

  // Pick image from camera or gallery
  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      let result;
      
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Camera access is needed to scan documents');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Photo library access is needed to upload documents');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      }
      
      if (!result.canceled && result.assets[0]) {
        await uploadDocument(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Upload document with AI extraction
  const uploadDocument = async (imageUri: string) => {
    setIsUploading(true);
    
    try {
      // Ensure protocol request exists
      const requestId = await ensureProtocolRequest();
      if (!requestId) {
        setIsUploading(false);
        return;
      }
      
      // Create form data
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'document.jpg';
      
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: filename,
      } as any);
      formData.append('document_type', 'lab_report');
      
      // Upload with AI extraction
      const response: DocumentUploadResponse = await uploadDocumentWithExtraction(requestId, formData);
      
      // Add to uploaded documents
      const newDoc: ExtractedDocument = {
        id: response.document_id,
        type: response.document_type,
        filename: filename,
        imageUri: imageUri,
        extractedData: response.extracted_data,
        confidence: response.overall_confidence,
        needsVerification: response.needs_verification,
      };
      
      setUploadedDocuments(prev => [...prev, newDoc]);
      
      // Update clinical data with extracted data
      if (response.clinical_data_updates) {
        setClinicalData(prev => ({
          ...prev,
          ...response.clinical_data_updates,
        }));
      }
      
      // Show extraction result
      if (response.extraction_success) {
        Alert.alert(
          '✅ Document Analyzed',
          `AI extracted clinical data with ${Math.round(response.overall_confidence * 100)}% confidence.\n\n${response.needs_verification ? '⚠️ Please verify the extracted data.' : ''}`,
          [
            { text: 'View Details', onPress: () => viewDocumentDetails(newDoc) },
            { text: 'OK' },
          ]
        );
      } else {
        Alert.alert('Warning', response.message);
      }
      
      // Refresh protocol request
      const updatedRequest = await getProtocolRequest(requestId);
      setProtocolRequest(updatedRequest);
      
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const viewDocumentDetails = (doc: ExtractedDocument) => {
    setSelectedDocument(doc);
    setShowDocumentModal(true);
  };

  // Update clinical data
  const handleUpdateClinicalData = async () => {
    if (!protocolRequest) {
      Alert.alert('Error', 'No protocol request');
      return;
    }
    
    try {
      await updateClinicalData(protocolRequest.id, clinicalData);
      Alert.alert('Success', 'Clinical data updated');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update clinical data');
    }
  };

  // Submit for review and protocol generation
  const handleSubmitForReview = async () => {
    if (!protocolRequest) {
      Alert.alert('Error', 'No protocol request');
      return;
    }
    
    // Validate
    if (!clinicalData.cancer_type) {
      Alert.alert('Required', 'Please specify cancer type');
      return;
    }
    
    if (!clinicalData.height_cm || !clinicalData.weight_kg) {
      Alert.alert('Required', 'Please enter height and weight for BSA calculation');
      return;
    }
    
    if (uploadedDocuments.length === 0) {
      Alert.alert(
        'No Documents',
        'No lab reports uploaded. Continue without documents?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => submitForReview() },
        ]
      );
      return;
    }
    
    submitForReview();
  };

  const submitForReview = async () => {
    setIsSubmitting(true);
    
    try {
      // Update clinical data first
      await updateClinicalData(protocolRequest!.id, clinicalData);
      
      // Submit for AI protocol generation
      const result = await nurseSubmitForReview(protocolRequest!.id, nurseNotes);
      
      Alert.alert(
        '🤖 Protocol Generated',
        'AI has generated a treatment protocol based on the clinical data. It is now pending nurse review.',
        [
          {
            text: 'Review Now',
            onPress: () => router.push({
              pathname: '/(nurse)/protocol-review',
              params: { requestId: result.id.toString() },
            }),
          },
          { text: 'Later', onPress: () => router.back() },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit for review');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Protocol Request" showBackButton onBackPress={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Protocol Request" 
        showBackButton 
        onBackPress={() => router.back()}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient Selection / Info Card */}
        {!patient ? (
          <Card variant="elevated" padding="medium" style={styles.patientCard}>
            <TouchableOpacity 
              style={styles.selectPatientButton}
              onPress={() => setShowPatientSelector(true)}
            >
              <View style={styles.selectPatientIcon}>
                <Ionicons name="person-add" size={32} color={colors.primary[500]} />
              </View>
              <View style={styles.selectPatientText}>
                <Text style={styles.selectPatientTitle}>Select Patient</Text>
                <Text style={styles.selectPatientSubtitle}>
                  Choose a patient to start protocol request
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
            </TouchableOpacity>
          </Card>
        ) : (
          <Card variant="elevated" padding="medium" style={styles.patientCard}>
            <View style={styles.patientHeader}>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>
                  {patient.firstName} {patient.lastName}
                </Text>
                <Text style={styles.patientMeta}>
                  {patient.cancerType || 'Cancer type not specified'} • {patient.cancerStage || 'Stage TBD'}
                </Text>
              </View>
              {protocolRequest ? (
                <Badge 
                  label={protocolRequest.status.replace('_', ' ')} 
                  variant={protocolRequest.status === 'draft' ? 'neutral' : 'primary'}
                />
              ) : (
                <TouchableOpacity onPress={() => setShowPatientSelector(true)}>
                  <Ionicons name="swap-horizontal" size={24} color={colors.primary[500]} />
                </TouchableOpacity>
              )}
            </View>
          </Card>
        )}

        {/* Document Upload Section */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Lab Reports & Documents</Text>
          </View>
          
          <Text style={styles.sectionDescription}>
            Upload lab reports, imaging reports, or prescriptions. AI will automatically extract clinical data.
          </Text>
          
          {/* Upload Buttons */}
          <View style={styles.uploadButtons}>
            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={() => pickImage('camera')}
              disabled={isUploading}
            >
              <Ionicons name="camera" size={28} color={colors.primary[500]} />
              <Text style={styles.uploadButtonText}>Scan</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={() => pickImage('gallery')}
              disabled={isUploading}
            >
              <Ionicons name="images" size={28} color={colors.primary[500]} />
              <Text style={styles.uploadButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
          
          {isUploading && (
            <View style={styles.uploadingIndicator}>
              <ActivityIndicator size="small" color={colors.primary[500]} />
              <Text style={styles.uploadingText}>Analyzing document with AI...</Text>
            </View>
          )}
          
          {/* Uploaded Documents */}
          {uploadedDocuments.length > 0 && (
            <View style={styles.documentsContainer}>
              <Text style={styles.documentsTitle}>
                Uploaded Documents ({uploadedDocuments.length})
              </Text>
              {uploadedDocuments.map((doc) => (
                <TouchableOpacity 
                  key={doc.id}
                  style={styles.documentItem}
                  onPress={() => viewDocumentDetails(doc)}
                >
                  <Image source={{ uri: doc.imageUri }} style={styles.documentThumb} />
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName}>{doc.filename}</Text>
                    <Text style={styles.documentType}>{doc.type.replace('_', ' ')}</Text>
                    <View style={styles.confidenceRow}>
                      <View style={[
                        styles.confidenceDot,
                        { backgroundColor: doc.confidence > 0.8 ? colors.success : doc.confidence > 0.5 ? colors.warning : colors.error }
                      ]} />
                      <Text style={styles.confidenceText}>
                        {Math.round(doc.confidence * 100)}% confidence
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* Clinical Data Section */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="medical" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Clinical Data</Text>
          </View>
          
          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="Height (cm)"
                value={clinicalData.height_cm?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, height_cm: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 170"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Weight (kg)"
                value={clinicalData.weight_kg?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, weight_kg: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 70"
              />
            </View>
          </View>
          
          {clinicalData.height_cm && clinicalData.weight_kg && (
            <View style={styles.bsaDisplay}>
              <Text style={styles.bsaLabel}>Calculated BSA:</Text>
              <Text style={styles.bsaValue}>
                {(Math.sqrt((clinicalData.height_cm * clinicalData.weight_kg) / 3600)).toFixed(2)} m²
              </Text>
            </View>
          )}
          
          <Input
            label="Cancer Type"
            value={clinicalData.cancer_type || ''}
            onChangeText={(v) => setClinicalData(prev => ({ ...prev, cancer_type: v }))}
            placeholder="e.g., Breast Cancer, Lung Cancer"
          />
          
          <Input
            label="Disease Stage"
            value={clinicalData.disease_stage || ''}
            onChangeText={(v) => setClinicalData(prev => ({ ...prev, disease_stage: v }))}
            placeholder="e.g., Stage IIIA, Metastatic"
          />
          
          <Input
            label="ECOG Performance Status (0-4)"
            value={clinicalData.performance_status || ''}
            onChangeText={(v) => setClinicalData(prev => ({ ...prev, performance_status: v }))}
            keyboardType="number-pad"
            placeholder="0 = Fully active"
          />
          
          <Button
            title="Save Clinical Data"
            variant="outline"
            onPress={handleUpdateClinicalData}
            style={styles.saveButton}
          />
        </Card>

        {/* Nurse Notes */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Nurse Notes</Text>
          </View>
          
          <Input
            label="Additional Notes"
            value={nurseNotes}
            onChangeText={setNurseNotes}
            multiline
            numberOfLines={4}
            placeholder="Any observations, concerns, or special considerations..."
          />
        </Card>

        {/* Submit Button */}
        <Button
          title="Generate AI Protocol"
          variant="primary"
          size="large"
          onPress={handleSubmitForReview}
          loading={isSubmitting}
          fullWidth
          style={styles.submitButton}
          icon={<Ionicons name="sparkles" size={20} color="#FFF" style={{ marginRight: 8 }} />}
        />
        
        <Text style={styles.submitHint}>
          AI will analyze all data and generate a treatment protocol for review
        </Text>
      </ScrollView>

      {/* Document Details Modal */}
      <Modal
        visible={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        title="Extracted Data"
        size="large"
      >
        {selectedDocument && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Image 
              source={{ uri: selectedDocument.imageUri }} 
              style={styles.modalImage}
              resizeMode="contain"
            />
            
            <View style={styles.confidenceBadge}>
              <Badge 
                label={`${Math.round(selectedDocument.confidence * 100)}% Confidence`}
                variant={selectedDocument.confidence > 0.8 ? 'success' : selectedDocument.confidence > 0.5 ? 'warning' : 'error'}
              />
              {selectedDocument.needsVerification && (
                <Badge label="Needs Verification" variant="warning" />
              )}
            </View>
            
            <Text style={styles.modalSectionTitle}>Extracted Lab Values</Text>
            
            {selectedDocument.extractedData?.lab_values?.map((lab: any, index: number) => (
              <View key={index} style={styles.labItem}>
                <Text style={styles.labName}>{lab.parameter}</Text>
                <View style={styles.labValueRow}>
                  <Text style={styles.labValue}>{lab.value} {lab.unit}</Text>
                  {lab.status && (
                    <Badge 
                      label={lab.status}
                      variant={lab.status === 'normal' ? 'success' : lab.status === 'critical' ? 'error' : 'warning'}
                      size="small"
                    />
                  )}
                </View>
                {lab.reference_range && (
                  <Text style={styles.labReference}>Ref: {lab.reference_range}</Text>
                )}
              </View>
            ))}
            
            {selectedDocument.extractedData?.diagnoses && selectedDocument.extractedData.diagnoses.length > 0 && (
              <>
                <Text style={styles.modalSectionTitle}>Diagnoses</Text>
                {selectedDocument.extractedData.diagnoses.map((dx: any, index: number) => (
                  <View key={index} style={styles.diagnosisItem}>
                    <Text style={styles.diagnosisText}>{dx.diagnosis}</Text>
                    {dx.icd_code && <Text style={styles.icdCode}>ICD: {dx.icd_code}</Text>}
                  </View>
                ))}
              </>
            )}
            
            {selectedDocument.extractedData?.key_findings && selectedDocument.extractedData.key_findings.length > 0 && (
              <>
                <Text style={styles.modalSectionTitle}>Key Findings</Text>
                {selectedDocument.extractedData.key_findings.map((finding: string, index: number) => (
                  <Text key={index} style={styles.findingItem}>• {finding}</Text>
                ))}
              </>
            )}
          </ScrollView>
        )}
      </Modal>

      {/* Patient Selector Modal */}
      <Modal
        visible={showPatientSelector}
        onClose={() => setShowPatientSelector(false)}
        title="Select Patient"
        size="large"
      >
        <View style={styles.patientSelectorContainer}>
          <Input
            placeholder="Search patients..."
            value={patientSearchQuery}
            onChangeText={setPatientSearchQuery}
          />
          
          {loadingPatients ? (
            <View style={styles.patientListLoading}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={styles.loadingText}>Loading patients...</Text>
            </View>
          ) : filteredPatients.length === 0 ? (
            <View style={styles.patientListEmpty}>
              <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No patients found</Text>
            </View>
          ) : (
            <FlatList
              data={filteredPatients}
              keyExtractor={(item) => item.id}
              style={styles.patientList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.patientListItem}
                  onPress={() => selectPatient(item)}
                >
                  <View style={styles.patientListAvatar}>
                    <Ionicons name="person" size={24} color={colors.primary[500]} />
                  </View>
                  <View style={styles.patientListInfo}>
                    <Text style={styles.patientListName}>
                      {item.firstName} {item.lastName}
                    </Text>
                    <Text style={styles.patientListMeta}>
                      {item.cancerType || 'Cancer type TBD'} • {item.cancerStage || 'Stage TBD'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  patientCard: {
    marginBottom: spacing.lg,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  patientMeta: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  sectionDescription: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    marginTop: spacing.sm,
    fontSize: typography.callout.fontSize,
    fontWeight: '600',
    color: colors.primary[500],
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
  },
  uploadingText: {
    marginLeft: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.primary[600],
  },
  documentsContainer: {
    marginTop: spacing.md,
  },
  documentsTitle: {
    fontSize: typography.callout.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  documentThumb: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.neutral[200],
  },
  documentInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  documentName: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
  },
  documentType: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  confidenceText: {
    fontSize: typography.caption2.fontSize,
    color: colors.text.tertiary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputHalf: {
    flex: 1,
  },
  bsaDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  bsaLabel: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  bsaValue: {
    fontSize: typography.headline.fontSize,
    fontWeight: '700',
    color: colors.success,
  },
  saveButton: {
    marginTop: spacing.md,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
  submitHint: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  confidenceBadge: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  modalSectionTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  labItem: {
    padding: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  labName: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
  },
  labValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  labValue: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
  },
  labReference: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  diagnosisItem: {
    padding: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  diagnosisText: {
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
  },
  icdCode: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  findingItem: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  // Patient selector styles
  selectPatientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  selectPatientIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  selectPatientText: {
    flex: 1,
  },
  selectPatientTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  selectPatientSubtitle: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  patientSelectorContainer: {
    flex: 1,
    minHeight: 400,
  },
  patientListLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  patientListEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  patientList: {
    flex: 1,
    marginTop: spacing.md,
  },
  patientListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  patientListAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  patientListInfo: {
    flex: 1,
  },
  patientListName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text.primary,
  },
  patientListMeta: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
