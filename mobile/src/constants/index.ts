/**
 * Application-wide constants
 */

export const APP_NAME = 'ChemoCare AI';
export const APP_VERSION = '1.0.0';

// API Configuration
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api/v1'
  : 'https://api.chemocare.ai/api/v1';

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  PUSH_TOKEN: 'push_token',
} as const;

// User Roles
export const USER_ROLES = {
  PATIENT: 'patient',
  DOCTOR_OPD: 'doctor_opd',
  DOCTOR_DAYCARE: 'doctor_daycare',
  NURSE: 'nurse',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Treatment Plan Status
export const PLAN_STATUS = {
  DRAFT: 'draft',
  PENDING_OPD_APPROVAL: 'pending_opd_approval',
  PENDING_DAYCARE_APPROVAL: 'pending_daycare_approval',
  APPROVED: 'approved',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ON_HOLD: 'on_hold',
} as const;

export type PlanStatus = typeof PLAN_STATUS[keyof typeof PLAN_STATUS];

// Cycle Status
export const CYCLE_STATUS = {
  SCHEDULED: 'scheduled',
  PRE_ASSESSMENT: 'pre_assessment',
  APPROVED: 'approved',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DELAYED: 'delayed',
  CANCELLED: 'cancelled',
} as const;

export type CycleStatus = typeof CYCLE_STATUS[keyof typeof CYCLE_STATUS];

// Appointment Types
export const APPOINTMENT_TYPES = {
  OPD_CONSULTATION: 'opd_consultation',
  DAYCARE_CHEMO: 'daycare_chemo',
  FOLLOW_UP: 'follow_up',
  LAB_WORK: 'lab_work',
  IMAGING: 'imaging',
  OTHER: 'other',
} as const;

export type AppointmentType = typeof APPOINTMENT_TYPES[keyof typeof APPOINTMENT_TYPES];

// Appointment Status
export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  RESCHEDULED: 'rescheduled',
} as const;

export type AppointmentStatus = typeof APPOINTMENT_STATUS[keyof typeof APPOINTMENT_STATUS];

// Document Types
export const DOCUMENT_TYPES = {
  PRESCRIPTION: 'prescription',
  LAB_REPORT: 'lab_report',
  PATHOLOGY: 'pathology',
  RADIOLOGY: 'radiology',
  DISCHARGE_SUMMARY: 'discharge_summary',
  INSURANCE: 'insurance',
  CONSENT_FORM: 'consent_form',
  OTHER: 'other',
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

// Alert Levels
export const ALERT_LEVELS = {
  NORMAL: 'normal',
  MONITOR: 'monitor',
  URGENT: 'urgent',
} as const;

export type AlertLevel = typeof ALERT_LEVELS[keyof typeof ALERT_LEVELS];

// Pain Scale Labels
export const PAIN_SCALE = [
  { value: 0, label: 'No pain' },
  { value: 1, label: 'Minimal' },
  { value: 2, label: 'Mild' },
  { value: 3, label: 'Uncomfortable' },
  { value: 4, label: 'Moderate' },
  { value: 5, label: 'Distracting' },
  { value: 6, label: 'Distressing' },
  { value: 7, label: 'Unmanageable' },
  { value: 8, label: 'Intense' },
  { value: 9, label: 'Severe' },
  { value: 10, label: 'Worst possible' },
] as const;

// Blood Groups
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export type BloodGroup = typeof BLOOD_GROUPS[number];

// Gender Options
export const GENDERS = ['male', 'female', 'other'] as const;

export type Gender = typeof GENDERS[number];
