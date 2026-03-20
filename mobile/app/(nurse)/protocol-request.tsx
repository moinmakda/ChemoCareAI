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
  TextInput,
  Platform,
  FlatList,
  KeyboardAvoidingView,
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
  getSophiaProtocols,
  getSophiaCategories,
  ProtocolRequest,
  DocumentUploadResponse,
  ClinicalDataCollection,
  SophiaProtocol,
  SophiaProtocolCategory,
} from '../../src/services/protocolService';
import { patientService, treatmentService } from '../../src/services';

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
  
  // Protocol selector state
  const [showProtocolSelector, setShowProtocolSelector] = useState(false);
  const [sophiaProtocols, setSophiaProtocols] = useState<SophiaProtocol[]>([]);
  const [protocolCategories, setProtocolCategories] = useState<SophiaProtocolCategory[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<SophiaProtocol | null>(null);
  const [protocolSearchQuery, setProtocolSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingProtocols, setLoadingProtocols] = useState(false);
  const [protocolAutoFilled, setProtocolAutoFilled] = useState(false);
  const [activeTreatmentPlan, setActiveTreatmentPlan] = useState<any>(null);

  // Clinical data form (extended for SOPHIA)
  const [clinicalData, setClinicalData] = useState<Record<string, any>>({
    height_cm: undefined,
    weight_kg: undefined,
    cancer_type: '',
    disease_stage: '',
    current_symptoms: [],
    performance_status: '',
    // SOPHIA-required labs
    neutrophils: undefined,
    platelets: undefined,
    hemoglobin: undefined,
    bilirubin: undefined,
    gfr: undefined,
    creatinine: undefined,
    // Safety fields
    known_allergies: [],
    active_infection: false,
    pregnancy_status: 'not_applicable',
    // Optional
    ast: undefined,
    alt: undefined,
    lvef_percent: undefined,
    prior_anthracycline_dose: undefined,
    peripheral_neuropathy_grade: undefined,
  });

  const [allergyInput, setAllergyInput] = useState('');
  const [nurseNotes, setNurseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing request or patient data
  useEffect(() => {
    loadData();
    loadAllPatients();
    loadProtocolCategories();
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

  const loadProtocolCategories = async () => {
    try {
      const cats = await getSophiaCategories();
      setProtocolCategories(cats);
    } catch {
      // silent
    }
  };

  // Auto-fill protocol from patient's existing treatment plan
  const autoFillProtocolFromPlan = async (patientId: string) => {
    try {
      const plans = await treatmentService.listTreatmentPlans(patientId);
      // Find an active/approved treatment plan
      const activePlan = plans.find(
        (p: any) => p.status === 'active' || p.status === 'approved'
      );
      if (activePlan) {
        setActiveTreatmentPlan(activePlan);
        // Extract protocol info from the plan
        const protocolName = activePlan.protocolName || activePlan.protocol_name;
        const customProtocol = activePlan.customProtocol || activePlan.custom_protocol || {};
        const protocolCode = customProtocol.protocolCode || customProtocol.protocol_code || protocolName;

        if (protocolCode) {
          // Build a SophiaProtocol-like object from treatment plan data
          const autoProtocol: SophiaProtocol = {
            id: activePlan.id,
            code: protocolCode,
            name: protocolName || protocolCode,
            indication: customProtocol.indication || '',
            drugs: (customProtocol.chemotherapyDrugs || customProtocol.chemotherapy_drugs || [])
              .map((d: any) => d.drugName || d.drug_name || d.name || '').filter(Boolean),
            cycleLengthDays: customProtocol.cycleLengthDays || customProtocol.cycle_length_days || 21,
            totalCycles: activePlan.plannedCycles || activePlan.planned_cycles || 6,
            category: '',
          };
          setSelectedProtocol(autoProtocol);
          setProtocolAutoFilled(true);

          // Determine next cycle number
          const completedCycles = activePlan.completedCycles || activePlan.completed_cycles || 0;
          setClinicalData(prev => ({
            ...prev,
            protocol_code: protocolCode,
            cycle_number: completedCycles + 1,
          }));
        }
      }
    } catch {
      // Silent — protocol selector stays manual
    }
  };

  const searchProtocols = async (query: string, category?: string | null) => {
    setLoadingProtocols(true);
    try {
      const params: any = {};
      if (query && query.trim().length > 0) params.search = query.trim();
      if (category) params.category = category;
      const results = await getSophiaProtocols(Object.keys(params).length > 0 ? params : undefined);
      setSophiaProtocols(results);
    } catch {
      setSophiaProtocols([]);
    } finally {
      setLoadingProtocols(false);
    }
  };

  const selectProtocol = (protocol: SophiaProtocol) => {
    setSelectedProtocol(protocol);
    setShowProtocolSelector(false);
    // Auto-fill cancer type from protocol
    if (protocol.category && !clinicalData.cancer_type) {
      setClinicalData(prev => ({
        ...prev,
        cancer_type: protocol.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      }));
    }
  };

  const addAllergy = () => {
    const trimmed = allergyInput.trim();
    if (trimmed && !clinicalData.known_allergies?.includes(trimmed)) {
      setClinicalData(prev => ({
        ...prev,
        known_allergies: [...(prev.known_allergies || []), trimmed],
      }));
      setAllergyInput('');
    }
  };

  const removeAllergy = (allergy: string) => {
    setClinicalData(prev => ({
      ...prev,
      known_allergies: (prev.known_allergies || []).filter((a: string) => a !== allergy),
    }));
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (params.requestId) {
        // Load existing protocol request
        const request = await getProtocolRequest(params.requestId);
        setProtocolRequest(request);
        if ((request as any).clinicalData) {
          setClinicalData((request as any).clinicalData);
        }
        // Load patient
        const patientData = await patientService.getPatient(request.patientId);
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

        // Auto-fill protocol from existing treatment plan
        await autoFillProtocolFromPlan(params.patientId);
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
    // Reset protocol auto-fill state for new patient
    setProtocolAutoFilled(false);
    setActiveTreatmentPlan(null);
    setSelectedProtocol(null);
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

      // Auto-fill protocol from existing treatment plan
      await autoFillProtocolFromPlan(selectedPatient.id);
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
        id: response.documentId,
        type: response.documentType,
        filename: filename,
        imageUri: imageUri,
        extractedData: response.extractedData,
        confidence: response.overallConfidence,
        needsVerification: response.needsVerification,
      };

      setUploadedDocuments(prev => [...prev, newDoc]);

      // Update clinical data with extracted data
      if (response.clinicalDataUpdates) {
        setClinicalData(prev => ({
          ...prev,
          ...response.clinicalDataUpdates,
        }));
      }

      // Show extraction result
      if (response.extractionSuccess) {
        Alert.alert(
          '✅ Document Analyzed',
          `AI extracted clinical data with ${Math.round(response.overallConfidence * 100)}% confidence.\n\n${response.needsVerification ? '⚠️ Please verify the extracted data.' : ''}`,
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
    if (!patient) {
      Alert.alert('Select Patient', 'Please select a patient first');
      return;
    }
    const requestId = await ensureProtocolRequest();
    if (!requestId) return;

    try {
      await updateClinicalData(requestId, clinicalData);
      Alert.alert('Success', 'Clinical data saved');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save clinical data');
    }
  };

  // Submit for review and protocol generation
  const handleSubmitForReview = async () => {
    if (!patient) {
      Alert.alert('Select Patient', 'Please select a patient first');
      return;
    }

    // Validate protocol selection
    if (!selectedProtocol) {
      Alert.alert('Required', 'Please select a protocol from the SOPHIA library');
      return;
    }

    // Validate required measurements
    if (!clinicalData.height_cm || !clinicalData.weight_kg) {
      Alert.alert('Required', 'Please enter height and weight for BSA calculation');
      return;
    }

    // Validate required labs (SOPHIA mandatory)
    const missingLabs: string[] = [];
    if (!clinicalData.neutrophils) missingLabs.push('Neutrophils');
    if (!clinicalData.platelets) missingLabs.push('Platelets');
    if (!clinicalData.hemoglobin) missingLabs.push('Haemoglobin');
    if (!clinicalData.bilirubin) missingLabs.push('Bilirubin');
    if (!clinicalData.gfr) missingLabs.push('GFR / CrCl');

    if (missingLabs.length > 0) {
      Alert.alert(
        'Required Labs Missing',
        `The following labs are mandatory for dose calculation:\n\n${missingLabs.join(', ')}\n\nPlease enter them or upload a lab report.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Ensure protocol request exists
    const requestId = await ensureProtocolRequest();
    if (!requestId) return;

    if (uploadedDocuments.length === 0) {
      Alert.alert(
        'No Documents',
        'No lab reports uploaded. Continue without documents?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => submitForReview(requestId) },
        ]
      );
      return;
    }

    submitForReview(requestId);
  };

  const submitForReview = async (reqId?: string) => {
    const requestId = reqId || protocolRequest?.id;
    if (!requestId) {
      Alert.alert('Error', 'Please select a patient first');
      return;
    }

    setIsSubmitting(true);

    try {
      // Include protocol_code in clinical data for SOPHIA engine
      const dataWithProtocol: Record<string, any> = {
        ...clinicalData,
        protocol_code: selectedProtocol?.code,
      };

      // Update clinical data first
      await updateClinicalData(requestId, dataWithProtocol as any);

      // Submit for SOPHIA protocol generation
      const result = await nurseSubmitForReview(requestId, nurseNotes);

      Alert.alert(
        'Protocol Generated',
        `${selectedProtocol?.name} protocol has been generated with deterministic dose calculations. Ready for nurse review.`,
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
      const detail = error.response?.data?.detail || error.message || 'Failed to submit for review';
      Alert.alert('Error', String(detail));
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
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

        {/* Protocol Selector */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flask" size={24} color={colors.primary[500]} />
            <Text style={styles.sectionTitle}>Protocol Selection</Text>
          </View>

          {selectedProtocol ? (
            <View>
              {protocolAutoFilled && (
                <View style={styles.autoFilledBadge}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
                  <Text style={styles.autoFilledText}>
                    Protocol assigned by doctor{activeTreatmentPlan ? ` — Cycle ${clinicalData.cycle_number || 1}` : ''}
                  </Text>
                </View>
              )}
              <View style={styles.selectedProtocolCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedProtocolCode}>{selectedProtocol.code}</Text>
                  <Text style={styles.selectedProtocolName} numberOfLines={2}>{selectedProtocol.name}</Text>
                  <Text style={styles.selectedProtocolMeta}>
                    {selectedProtocol.cycleLengthDays}-day cycle  |  {selectedProtocol.totalCycles} cycles  |  {selectedProtocol.drugs.length} drugs
                  </Text>
                  <View style={styles.drugChips}>
                    {selectedProtocol.drugs.slice(0, 4).map((drug, i) => (
                      <View key={i} style={styles.drugChip}>
                        <Text style={styles.drugChipText}>{drug}</Text>
                      </View>
                    ))}
                    {selectedProtocol.drugs.length > 4 && (
                      <Text style={styles.moreDrugs}>+{selectedProtocol.drugs.length - 4} more</Text>
                    )}
                  </View>
                </View>
                {!protocolAutoFilled && (
                  <TouchableOpacity onPress={() => setShowProtocolSelector(true)}>
                    <Ionicons name="swap-horizontal" size={24} color={colors.primary[500]} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.selectPatientButton}
              onPress={() => {
                setShowProtocolSelector(true);
                setProtocolSearchQuery('');
                setSelectedCategory(null);
                searchProtocols('', null);
              }}
            >
              <View style={styles.selectPatientIcon}>
                <Ionicons name="flask-outline" size={32} color={colors.primary[500]} />
              </View>
              <View style={styles.selectPatientText}>
                <Text style={styles.selectPatientTitle}>Select Protocol</Text>
                <Text style={styles.selectPatientSubtitle}>
                  Choose from 566+ NHS protocols
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </Card>

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
            <Text style={styles.sectionTitle}>Patient Data</Text>
          </View>

          {/* Demographics */}
          <Text style={styles.subsectionTitle}>Demographics</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="Height (cm) *"
                value={clinicalData.height_cm?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, height_cm: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 170"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Weight (kg) *"
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
                {Math.min(Math.sqrt((clinicalData.height_cm * clinicalData.weight_kg) / 3600), 2.0).toFixed(2)} m²
              </Text>
              {Math.sqrt((clinicalData.height_cm * clinicalData.weight_kg) / 3600) > 2.0 && (
                <Text style={styles.bsaCapped}> (capped at 2.0)</Text>
              )}
            </View>
          )}

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="Cancer Type"
                value={clinicalData.cancer_type || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, cancer_type: v }))}
                placeholder="e.g., DLBCL"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Disease Stage"
                value={clinicalData.disease_stage || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, disease_stage: v }))}
                placeholder="e.g., Stage IIIA"
              />
            </View>
          </View>

          <Input
            label="ECOG Performance Status (0-4) *"
            value={clinicalData.performance_status || ''}
            onChangeText={(v) => setClinicalData(prev => ({ ...prev, performance_status: v }))}
            keyboardType="number-pad"
            placeholder="0 = Fully active ... 4 = Completely disabled"
          />

          {/* Mandatory Labs */}
          <Text style={styles.subsectionTitle}>Mandatory Labs</Text>
          <Text style={styles.subsectionHint}>Required for dose calculations and safety checks</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="Neutrophils (x10^9/L) *"
                value={clinicalData.neutrophils?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, neutrophils: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 2.5"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Platelets (x10^9/L) *"
                value={clinicalData.platelets?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, platelets: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 150"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="Haemoglobin (g/dL) *"
                value={clinicalData.hemoglobin?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, hemoglobin: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 12.0"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Bilirubin (umol/L) *"
                value={clinicalData.bilirubin?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, bilirubin: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 15"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="GFR / CrCl (ml/min) *"
                value={clinicalData.gfr?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, gfr: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 85"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Creatinine (umol/L)"
                value={clinicalData.creatinine?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, creatinine: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 80"
              />
            </View>
          </View>

          {/* Optional Labs */}
          <Text style={styles.subsectionTitle}>Optional Labs</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="AST (U/L)"
                value={clinicalData.ast?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, ast: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 25"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="ALT (U/L)"
                value={clinicalData.alt?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, alt: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 30"
              />
            </View>
          </View>

          {/* Safety Assessment */}
          <Text style={styles.subsectionTitle}>Safety Assessment</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="LVEF % (cardiac)"
                value={clinicalData.lvef_percent?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, lvef_percent: v ? parseFloat(v) : undefined }))}
                keyboardType="decimal-pad"
                placeholder="e.g., 55"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Neuropathy Grade (0-4)"
                value={clinicalData.peripheral_neuropathy_grade?.toString() || ''}
                onChangeText={(v) => setClinicalData(prev => ({ ...prev, peripheral_neuropathy_grade: v ? parseInt(v) : undefined }))}
                keyboardType="number-pad"
                placeholder="CTCAE 0-4"
              />
            </View>
          </View>

          <Input
            label="Prior Anthracycline Dose (mg/m2)"
            value={clinicalData.prior_anthracycline_dose?.toString() || ''}
            onChangeText={(v) => setClinicalData(prev => ({ ...prev, prior_anthracycline_dose: v ? parseFloat(v) : undefined }))}
            keyboardType="decimal-pad"
            placeholder="Lifetime cumulative (e.g., 240)"
          />

          {/* Allergies */}
          <Text style={styles.subsectionTitle}>Known Drug Allergies</Text>
          <View style={styles.allergyInputRow}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="e.g., platinum, rituximab..."
                value={allergyInput}
                onChangeText={setAllergyInput}
                onSubmitEditing={addAllergy}
              />
            </View>
            <TouchableOpacity style={styles.addAllergyButton} onPress={addAllergy}>
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {(clinicalData.known_allergies || []).length > 0 && (
            <View style={styles.allergyChips}>
              {clinicalData.known_allergies.map((allergy: string, i: number) => (
                <View key={i} style={styles.allergyChip}>
                  <Text style={styles.allergyChipText}>{allergy}</Text>
                  <TouchableOpacity onPress={() => removeAllergy(allergy)}>
                    <Ionicons name="close-circle" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Active Infection Toggle */}
          <TouchableOpacity
            style={[
              styles.toggleRow,
              clinicalData.active_infection && styles.toggleRowActive,
            ]}
            onPress={() => setClinicalData(prev => ({ ...prev, active_infection: !prev.active_infection }))}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Active Infection / Fever</Text>
              <Text style={styles.toggleHint}>Treatment delay may be recommended</Text>
            </View>
            <Ionicons
              name={clinicalData.active_infection ? 'checkbox' : 'square-outline'}
              size={24}
              color={clinicalData.active_infection ? colors.error : colors.text.tertiary}
            />
          </TouchableOpacity>

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
          title={selectedProtocol ? `Generate ${selectedProtocol.code} Protocol` : 'Generate Protocol'}
          variant="primary"
          size="large"
          onPress={handleSubmitForReview}
          loading={isSubmitting}
          fullWidth
          style={styles.submitButton}
          icon={<Ionicons name="calculator" size={20} color="#FFF" style={{ marginRight: 8 }} />}
        />

        <Text style={styles.submitHint}>
          SOPHIA engine will calculate doses, apply safety checks, and generate a treatment protocol for review
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>

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

      {/* Protocol Selector — Full Screen Modal */}
      {showProtocolSelector && (
        <View style={styles.protocolModalOverlay}>
          <View style={styles.protocolModalContainer}>
            {/* Header */}
            <View style={styles.protocolModalHeader}>
              <Text style={styles.protocolModalTitle}>Select Protocol</Text>
              <TouchableOpacity
                onPress={() => setShowProtocolSelector(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.protocolModalSearch}>
              <View style={styles.protocolSearchInputWrap}>
                <Ionicons name="search" size={20} color={colors.text.tertiary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.protocolSearchInput}
                  placeholder="Search by name, code, or drug..."
                  placeholderTextColor={colors.text.tertiary}
                  value={protocolSearchQuery}
                  onChangeText={(v) => {
                    setProtocolSearchQuery(v);
                    searchProtocols(v, selectedCategory);
                  }}
                  autoFocus
                  returnKeyType="search"
                />
                {protocolSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setProtocolSearchQuery('');
                    searchProtocols('', selectedCategory);
                  }}>
                    <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Category Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              <TouchableOpacity
                style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
                onPress={() => {
                  setSelectedCategory(null);
                  searchProtocols(protocolSearchQuery, null);
                }}
              >
                <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
                  All ({protocolCategories.reduce((s, c) => s + c.count, 0)})
                </Text>
              </TouchableOpacity>
              {protocolCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.name}
                  style={[styles.categoryChip, selectedCategory === cat.name && styles.categoryChipActive]}
                  onPress={() => {
                    setSelectedCategory(cat.name);
                    searchProtocols(protocolSearchQuery, cat.name);
                  }}
                >
                  <Text style={[
                    styles.categoryChipText,
                    selectedCategory === cat.name && styles.categoryChipTextActive,
                  ]}>{cat.name} ({cat.count})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Results */}
            {loadingProtocols ? (
              <View style={styles.protocolModalEmpty}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={styles.loadingText}>Loading protocols...</Text>
              </View>
            ) : sophiaProtocols.length === 0 ? (
              <View style={styles.protocolModalEmpty}>
                <Ionicons name="flask-outline" size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>
                  {protocolSearchQuery ? 'No protocols found' : 'Tap a category or search'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={sophiaProtocols}
                keyExtractor={(item) => item.code}
                style={styles.protocolModalList}
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.protocolListItem}
                    onPress={() => selectProtocol(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.protocolListCode}>{item.code}</Text>
                      <Text style={styles.protocolListName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.protocolListDrugs} numberOfLines={1}>
                        {item.drugs.join(', ')}
                      </Text>
                      <Text style={styles.protocolListMeta}>
                        {item.cycleLengthDays}d cycle  |  {item.totalCycles} cycles
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      )}

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
  autoFilledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  autoFilledText: {
    fontSize: typography.caption1.fontSize,
    fontWeight: '600',
    color: colors.success,
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
  // Full-screen protocol selector
  protocolModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.secondary,
    zIndex: 100,
  },
  protocolModalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  protocolModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  protocolModalTitle: {
    fontSize: 22,
    fontWeight: '700' as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  protocolModalSearch: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  protocolSearchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  protocolSearchInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    padding: 0,
  },
  protocolModalList: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  protocolModalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  // Protocol selector card styles
  selectedProtocolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  selectedProtocolCode: {
    fontSize: typography.headline.fontSize,
    fontWeight: '700' as TextStyle['fontWeight'],
    color: colors.primary[600],
  },
  selectedProtocolName: {
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  selectedProtocolMeta: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  drugChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  drugChip: {
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  drugChipText: {
    fontSize: typography.caption2.fontSize,
    color: colors.primary[700],
    fontWeight: '500',
  },
  moreDrugs: {
    fontSize: typography.caption2.fontSize,
    color: colors.text.tertiary,
    alignSelf: 'center',
  },
  protocolListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  protocolListCode: {
    fontSize: typography.callout.fontSize,
    fontWeight: '700',
    color: colors.primary[600],
  },
  protocolListName: {
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
    marginTop: 2,
  },
  protocolListDrugs: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: 2,
  },
  protocolListMeta: {
    fontSize: typography.caption2.fontSize,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  categoryScroll: {
    marginVertical: spacing.sm,
  },
  categoryScrollContent: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  categoryChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  categoryChipText: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
  // Clinical data extended styles
  subsectionTitle: {
    fontSize: typography.callout.fontSize,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  subsectionHint: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  bsaCapped: {
    fontSize: typography.caption1.fontSize,
    color: colors.warning,
    fontWeight: '600',
  },
  allergyInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  addAllergyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  allergyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  allergyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  allergyChipText: {
    fontSize: typography.caption1.fontSize,
    color: colors.error,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  toggleRowActive: {
    backgroundColor: '#FEE2E2',
    borderColor: colors.error,
  },
  toggleLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
  },
  toggleHint: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
    marginTop: 2,
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
