/**
 * TypeScript type definitions for the application
 */

export interface User {
  id: string;
  email: string;
  phone?: string;
  full_name?: string;
  avatar?: string;
  role: 'patient' | 'doctor_opd' | 'doctor_daycare' | 'nurse' | 'admin';
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface Patient {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  heightCm?: number;
  weightKg?: number;
  bsa: number;
  age: number;
  allergies: string[];
  comorbidities: string[];
  currentMedications: any[];
  cancerType?: string;
  cancerStage?: string;
  diagnosisDate?: string;
  histopathologyDetails?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceValidity?: string;
  profilePhotoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  specialization?: string;
  qualification?: string;
  registrationNumber: string;
  experienceYears?: number;
  isOpdDoctor: boolean;
  isDaycareDoctor: boolean;
  profilePhotoUrl?: string;
  signatureUrl?: string;
}

export interface Nurse {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  qualification?: string;
  registrationNumber: string;
  experienceYears?: number;
  chemoCertified: boolean;
  certificationDate?: string;
  profilePhotoUrl?: string;
}

export interface ProtocolTemplate {
  id: string;
  name: string;
  fullName?: string;
  cancerTypes: string[];
  cycleDays: number;
  totalCycles?: number;
  drugs: DrugInProtocol[];
  preMedications: Medication[];
  postMedications: Medication[];
  requiredLabs: string[];
  monitoringParameters: string[];
  doseModificationRules: DoseModificationRule[];
  commonSideEffects: string[];
  seriousSideEffects: string[];
  referenceGuidelines?: string;
  isActive: boolean;
  createdAt: string;
}

export interface DrugInProtocol {
  drugName: string;
  genericName?: string;
  dosePerM2: number;
  unit: string;
  route: string;
  infusionDurationMins?: number;
  days: number[];
  dilution?: string;
  specialInstructions?: string;
  maxLifetimeDose?: number;
  maxLifetimeDoseM2?: number;
}

export interface Medication {
  drugName: string;
  dose: string;
  route: string;
  timing: string;
}

export interface DoseModificationRule {
  parameter: string;
  condition: string;
  action: string;
  doseReduction?: number;
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  protocolTemplateId?: string;
  protocolName: string;
  customProtocol: any;
  startDate?: string;
  plannedCycles: number;
  completedCycles: number;
  status: TreatmentPlanStatus;
  aiRecommendations?: string;
  aiRiskAssessment?: any;
  aiConfidenceScore?: number;
  createdByDoctorId?: string;
  opdApprovedBy?: string;
  opdApprovedAt?: string;
  opdNotes?: string;
  daycareApprovedBy?: string;
  daycareApprovedAt?: string;
  daycareNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type TreatmentPlanStatus = 
  | 'draft'
  | 'pending_opd_approval'
  | 'pending_daycare_approval'
  | 'approved'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'on_hold';

export interface TreatmentCycle {
  id: string;
  treatmentPlanId: string;
  cycleNumber: number;
  scheduledDate: string;
  actualDate?: string;
  status: CycleStatus;
  preChemoLabs?: any;
  preChemoVitals?: any;
  patientWeightKg?: number;
  calculatedBsa?: number;
  doseModifications?: any;
  modificationReason?: string;
  daycareDoctorId?: string;
  approvedAt?: string;
  approvalNotes?: string;
  startedAt?: string;
  completedAt?: string;
  administeredBy?: string;
  immediateReactions?: any;
  dischargeNotes?: string;
  followUpInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

export type CycleStatus =
  | 'scheduled'
  | 'pre_assessment'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'delayed'
  | 'cancelled';

export interface DrugAdministration {
  id: string;
  cycleId: string;
  drugName: string;
  plannedDose: number;
  actualDose?: number;
  unit: string;
  route: string;
  plannedDurationMins?: number;
  actualDurationMins?: number;
  status: DrugAdminStatus;
  preparedBy?: string;
  preparedAt?: string;
  batchNumber?: string;
  expiryDate?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  startedAt?: string;
  completedAt?: string;
  administeredBy?: string;
  ivSite?: string;
  flowRate?: string;
  reactions: any[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type DrugAdminStatus =
  | 'pending'
  | 'prepared'
  | 'verified'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'stopped';

export interface Vital {
  id: string;
  patientId: string;
  cycleId?: string;
  recordedAt: string;
  recordedBy?: string;
  temperatureF?: number;
  pulseBpm?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  painScore?: number;
  painLocation?: string;
  bloodSugar?: number;
  weightKg?: number;
  notes?: string;
  timing?: string;
  aiAlerts: Alert[];
}

export interface Alert {
  type: string;
  message: string;
  severity: 'low' | 'warning' | 'critical';
}

export interface Appointment {
  id: string;
  patientId: string;
  appointmentType: AppointmentType;
  scheduledDate: string;
  scheduledTime: string;
  durationMins: number;
  cycleId?: string;
  chairNumber?: number;
  doctorId?: string;
  nurseId?: string;
  status: AppointmentStatus;
  checkedInAt?: string;
  checkedOutAt?: string;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentType =
  | 'opd_consultation'
  | 'daycare_chemo'
  | 'follow_up'
  | 'lab_work'
  | 'imaging'
  | 'other';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

export interface Document {
  id: string;
  patientId: string;
  documentType: DocumentType;
  title: string;
  description?: string;
  fileUrl: string;
  fileType?: string;
  fileSizeBytes?: number;
  extractedText?: string;
  extractedData?: any;
  uploadedBy?: string;
  uploadedAt: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export type DocumentType =
  | 'prescription'
  | 'lab_report'
  | 'pathology'
  | 'radiology'
  | 'discharge_summary'
  | 'insurance'
  | 'consent_form'
  | 'other';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export type NotificationType =
  | 'appointment_reminder'
  | 'lab_reminder'
  | 'approval_request'
  | 'approval_received'
  | 'cycle_completed'
  | 'vitals_alert'
  | 'reaction_alert'
  | 'document_uploaded'
  | 'message'
  | 'system';

export interface SymptomEntry {
  id: string;
  patientId: string;
  cycleId?: string;
  recordedAt: string;
  nauseaScore?: number;
  vomitingCount?: number;
  fatigueScore?: number;
  appetiteScore?: number;
  painScore?: number;
  hasFever: boolean;
  hasMouthSores: boolean;
  hasDiarrhea: boolean;
  hasConstipation: boolean;
  hasNumbness: boolean;
  hasHairLoss: boolean;
  hasSkinChanges: boolean;
  otherSymptoms?: string;
  moodNotes?: string;
  aiSeverityScore?: number;
  aiRecommendations?: string;
  aiAlertLevel?: 'normal' | 'monitor' | 'urgent';
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  phone?: string;
  password: string;
  full_name?: string;
  role: User['role'];
}
