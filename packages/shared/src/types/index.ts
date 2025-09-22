/**
 * PregnancyCare 360 - Shared Type Definitions
 * 
 * This file contains all shared TypeScript interfaces and types
 * used across the PregnancyCare 360 platform.
 */

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export enum UserRole {
  PATIENT = 'patient',
  PROVIDER = 'provider',
  ADMIN = 'admin',
  CLINICAL_STAFF = 'clinical_staff',
  SUPPORT = 'support'
}

export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  phoneNumber?: string;
  timezone: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: string;
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
  accessibility: AccessibilitySettings;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  emergencyOnly: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface PrivacySettings {
  shareDataWithResearchers: boolean;
  allowMarketingCommunications: boolean;
  dataRetentionPeriod: number; // in months
}

export interface AccessibilitySettings {
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  highContrast: boolean;
  screenReader: boolean;
  reducedMotion: boolean;
}

// ============================================================================
// PATIENT TYPES
// ============================================================================

export interface Patient extends BaseEntity {
  userId: string;
  dateOfBirth: Date;
  medicalRecordNumber?: string;
  emergencyContact: EmergencyContact;
  insuranceInfo?: InsuranceInfo;
  pregnancies: Pregnancy[];
  currentPregnancy?: Pregnancy;
  medicalHistory: MedicalHistory;
  allergies: Allergy[];
  medications: Medication[];
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phoneNumber: string;
  email?: string;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberId: string;
  effectiveDate: Date;
  expirationDate?: Date;
}

export interface MedicalHistory {
  previousPregnancies: number;
  liveBirths: number;
  miscarriages: number;
  abortions: number;
  cesareanSections: number;
  complications: PregnancyComplication[];
  chronicConditions: ChronicCondition[];
  surgicalHistory: Surgery[];
  familyHistory: FamilyHistoryItem[];
}

export interface Allergy {
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe';
  onsetDate?: Date;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  prescribedBy: string;
  indication: string;
}

// ============================================================================
// PREGNANCY TYPES
// ============================================================================

export interface Pregnancy extends BaseEntity {
  patientId: string;
  providerId: string;
  status: PregnancyStatus;
  lastMenstrualPeriod: Date;
  estimatedDueDate: Date;
  gestationalAge: number; // in weeks
  conception: ConceptionType;
  isHighRisk: boolean;
  riskFactors: RiskFactor[];
  currentRiskScore: number; // 0-100
  vitals: VitalSigns[];
  appointments: Appointment[];
  labResults: LabResult[];
  ultrasounds: Ultrasound[];
  complications: PregnancyComplication[];
  medications: PregnancyMedication[];
  deliveryInfo?: DeliveryInfo;
}

export enum PregnancyStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  TERMINATED = 'terminated',
  MISCARRIAGE = 'miscarriage'
}

export enum ConceptionType {
  NATURAL = 'natural',
  IVF = 'ivf',
  IUI = 'iui',
  OTHER_ART = 'other_art'
}

export interface RiskFactor {
  type: RiskFactorType;
  severity: 'low' | 'moderate' | 'high';
  description: string;
  identifiedAt: Date;
  managementPlan?: string;
}

export enum RiskFactorType {
  MATERNAL_AGE = 'maternal_age',
  HYPERTENSION = 'hypertension',
  DIABETES = 'diabetes',
  OBESITY = 'obesity',
  PREVIOUS_COMPLICATIONS = 'previous_complications',
  MULTIPLE_PREGNANCY = 'multiple_pregnancy',
  SUBSTANCE_USE = 'substance_use',
  MENTAL_HEALTH = 'mental_health',
  GENETIC_FACTORS = 'genetic_factors',
  ENVIRONMENTAL = 'environmental'
}

// ============================================================================
// MONITORING & VITAL SIGNS TYPES
// ============================================================================

export interface VitalSigns extends BaseEntity {
  pregnancyId: string;
  recordedAt: Date;
  recordedBy: string; // user ID or device ID
  source: DataSource;
  bloodPressure?: BloodPressure;
  heartRate?: number;
  weight?: number;
  temperature?: number;
  oxygenSaturation?: number;
  glucoseLevel?: number;
  fetalHeartRate?: number;
  fetalMovement?: FetalMovement;
  symptoms?: Symptom[];
  notes?: string;
}

export interface BloodPressure {
  systolic: number;
  diastolic: number;
  pulse?: number;
  position: 'sitting' | 'lying' | 'standing';
}

export interface FetalMovement {
  count: number;
  duration: number; // in minutes
  intensity: 'light' | 'moderate' | 'strong';
  pattern: 'regular' | 'irregular';
}

export interface Symptom {
  type: SymptomType;
  severity: 1 | 2 | 3 | 4 | 5;
  description?: string;
  duration?: number; // in minutes
  triggers?: string[];
}

export enum SymptomType {
  NAUSEA = 'nausea',
  VOMITING = 'vomiting',
  HEADACHE = 'headache',
  DIZZINESS = 'dizziness',
  FATIGUE = 'fatigue',
  SHORTNESS_OF_BREATH = 'shortness_of_breath',
  CHEST_PAIN = 'chest_pain',
  ABDOMINAL_PAIN = 'abdominal_pain',
  BACK_PAIN = 'back_pain',
  SWELLING = 'swelling',
  VISION_CHANGES = 'vision_changes',
  CONTRACTIONS = 'contractions',
  BLEEDING = 'bleeding',
  DISCHARGE = 'discharge',
  MOOD_CHANGES = 'mood_changes'
}

export enum DataSource {
  MANUAL_ENTRY = 'manual_entry',
  WEARABLE_DEVICE = 'wearable_device',
  HOME_MONITOR = 'home_monitor',
  CLINICAL_DEVICE = 'clinical_device',
  MOBILE_APP = 'mobile_app',
  PROVIDER_ENTRY = 'provider_entry'
}

// ============================================================================
// AI/ML & RISK ASSESSMENT TYPES
// ============================================================================

export interface RiskAssessment extends BaseEntity {
  pregnancyId: string;
  assessmentDate: Date;
  overallRiskScore: number; // 0-100
  riskCategories: RiskCategoryScore[];
  predictions: RiskPrediction[];
  recommendations: Recommendation[];
  confidence: number; // 0-1
  modelVersion: string;
  dataQuality: DataQualityMetrics;
}

export interface RiskCategoryScore {
  category: RiskCategory;
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'worsening';
  contributingFactors: string[];
}

export enum RiskCategory {
  PREECLAMPSIA = 'preeclampsia',
  GESTATIONAL_DIABETES = 'gestational_diabetes',
  PRETERM_BIRTH = 'preterm_birth',
  FETAL_GROWTH_RESTRICTION = 'fetal_growth_restriction',
  PLACENTAL_COMPLICATIONS = 'placental_complications',
  MATERNAL_MORTALITY = 'maternal_mortality',
  POSTPARTUM_DEPRESSION = 'postpartum_depression'
}

export interface RiskPrediction {
  condition: RiskCategory;
  probability: number; // 0-1
  timeframe: number; // days until predicted onset
  severity: 'mild' | 'moderate' | 'severe';
  earlyWarningSignals: string[];
}

export interface Recommendation {
  type: RecommendationType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  actionItems: string[];
  dueDate?: Date;
  assignedTo?: string;
  evidence: EvidenceLevel;
  resources?: Resource[];
}

export enum RecommendationType {
  LIFESTYLE = 'lifestyle',
  MEDICATION = 'medication',
  MONITORING = 'monitoring',
  APPOINTMENT = 'appointment',
  TESTING = 'testing',
  REFERRAL = 'referral',
  EMERGENCY = 'emergency',
  EDUCATION = 'education'
}

export enum EvidenceLevel {
  A = 'A', // High-quality evidence
  B = 'B', // Moderate-quality evidence
  C = 'C', // Low-quality evidence
  D = 'D', // Very low-quality evidence
  EXPERT_OPINION = 'expert_opinion'
}

export interface DataQualityMetrics {
  completeness: number; // 0-1
  accuracy: number; // 0-1
  timeliness: number; // 0-1
  consistency: number; // 0-1
  missingDataPoints: string[];
  lastUpdated: Date;
}

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export interface Provider extends BaseEntity {
  userId: string;
  npiNumber: string;
  licenseNumber: string;
  specialty: MedicalSpecialty;
  credentials: string[];
  practiceId?: string;
  patients: string[]; // patient IDs
  availability: ProviderAvailability[];
  preferences: ProviderPreferences;
}

export enum MedicalSpecialty {
  OBSTETRICS_GYNECOLOGY = 'obstetrics_gynecology',
  MATERNAL_FETAL_MEDICINE = 'maternal_fetal_medicine',
  FAMILY_MEDICINE = 'family_medicine',
  INTERNAL_MEDICINE = 'internal_medicine',
  MIDWIFERY = 'midwifery',
  NURSING = 'nursing',
  MENTAL_HEALTH = 'mental_health'
}

export interface ProviderAvailability {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string;
  isAvailable: boolean;
}

export interface ProviderPreferences {
  defaultAppointmentDuration: number; // in minutes
  bufferTime: number; // in minutes
  maxPatientsPerDay: number;
  emergencyContactMethod: 'phone' | 'pager' | 'secure_message';
  notificationSettings: ProviderNotificationSettings;
}

export interface ProviderNotificationSettings {
  highRiskAlerts: boolean;
  appointmentReminders: boolean;
  labResultAlerts: boolean;
  emergencyAlerts: boolean;
  dailyDigest: boolean;
}

// ============================================================================
// APPOINTMENT TYPES
// ============================================================================

export interface Appointment extends BaseEntity {
  pregnancyId: string;
  providerId: string;
  patientId: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: Date;
  duration: number; // in minutes
  location: AppointmentLocation;
  reason: string;
  notes?: string;
  vitalsRecorded?: VitalSigns;
  followUpRequired: boolean;
  followUpDate?: Date;
  cancellationReason?: string;
}

export enum AppointmentType {
  ROUTINE_CHECKUP = 'routine_checkup',
  HIGH_RISK_MONITORING = 'high_risk_monitoring',
  ULTRASOUND = 'ultrasound',
  LAB_WORK = 'lab_work',
  CONSULTATION = 'consultation',
  EMERGENCY = 'emergency',
  TELEHEALTH = 'telehealth',
  POSTPARTUM = 'postpartum'
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled'
}

export interface AppointmentLocation {
  type: 'in_person' | 'telehealth';
  address?: Address;
  room?: string;
  meetingLink?: string;
  instructions?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// ============================================================================
// LAB RESULTS & TESTING TYPES
// ============================================================================

export interface LabResult extends BaseEntity {
  pregnancyId: string;
  orderedBy: string; // provider ID
  testType: LabTestType;
  collectedAt: Date;
  resultedAt: Date;
  results: LabValue[];
  interpretation: LabInterpretation;
  criticalValues: boolean;
  followUpRequired: boolean;
  notes?: string;
}

export enum LabTestType {
  COMPLETE_BLOOD_COUNT = 'complete_blood_count',
  COMPREHENSIVE_METABOLIC_PANEL = 'comprehensive_metabolic_panel',
  GLUCOSE_TOLERANCE_TEST = 'glucose_tolerance_test',
  HEMOGLOBIN_A1C = 'hemoglobin_a1c',
  THYROID_FUNCTION = 'thyroid_function',
  URINALYSIS = 'urinalysis',
  PROTEIN_URINE = 'protein_urine',
  GROUP_B_STREP = 'group_b_strep',
  GENETIC_SCREENING = 'genetic_screening',
  INFECTIOUS_DISEASE = 'infectious_disease',
  COAGULATION_STUDIES = 'coagulation_studies'
}

export interface LabValue {
  name: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'abnormal' | 'critical' | 'pending';
  flag?: 'high' | 'low' | 'critical_high' | 'critical_low';
}

export interface LabInterpretation {
  summary: string;
  clinicalSignificance: string;
  recommendations: string[];
  riskImplications?: string[];
}

// ============================================================================
// ULTRASOUND & IMAGING TYPES
// ============================================================================

export interface Ultrasound extends BaseEntity {
  pregnancyId: string;
  performedBy: string; // provider ID
  performedAt: Date;
  gestationalAge: number; // in weeks
  type: UltrasoundType;
  measurements: FetalMeasurement[];
  findings: UltrasoundFinding[];
  images: UltrasoundImage[];
  interpretation: string;
  recommendations: string[];
}

export enum UltrasoundType {
  DATING = 'dating',
  NUCHAL_TRANSLUCENCY = 'nuchal_translucency',
  ANATOMY_SCAN = 'anatomy_scan',
  GROWTH_SCAN = 'growth_scan',
  BIOPHYSICAL_PROFILE = 'biophysical_profile',
  DOPPLER_STUDIES = 'doppler_studies',
  CERVICAL_LENGTH = 'cervical_length'
}

export interface FetalMeasurement {
  parameter: string;
  value: number;
  unit: string;
  percentile?: number;
  gestationalAge?: number;
  isNormal: boolean;
}

export interface UltrasoundFinding {
  category: string;
  finding: string;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  description: string;
  followUpRequired: boolean;
}

export interface UltrasoundImage {
  id: string;
  url: string;
  type: string;
  view: string;
  annotations?: ImageAnnotation[];
}

export interface ImageAnnotation {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  description?: string;
}

// ============================================================================
// COMPLICATIONS & OUTCOMES TYPES
// ============================================================================

export interface PregnancyComplication extends BaseEntity {
  pregnancyId: string;
  type: ComplicationType;
  severity: 'mild' | 'moderate' | 'severe';
  onsetDate: Date;
  resolvedDate?: Date;
  status: 'active' | 'resolved' | 'chronic';
  description: string;
  treatment: Treatment[];
  impact: ComplicationImpact;
}

export enum ComplicationType {
  PREECLAMPSIA = 'preeclampsia',
  GESTATIONAL_DIABETES = 'gestational_diabetes',
  PRETERM_LABOR = 'preterm_labor',
  PLACENTA_PREVIA = 'placenta_previa',
  PLACENTAL_ABRUPTION = 'placental_abruption',
  FETAL_GROWTH_RESTRICTION = 'fetal_growth_restriction',
  HYPEREMESIS_GRAVIDARUM = 'hyperemesis_gravidarum',
  CHOLESTASIS = 'cholestasis',
  ANEMIA = 'anemia',
  THROMBOEMBOLISM = 'thromboembolism'
}

export interface Treatment {
  type: 'medication' | 'procedure' | 'lifestyle' | 'monitoring';
  name: string;
  dosage?: string;
  frequency?: string;
  startDate: Date;
  endDate?: Date;
  effectiveness: 'excellent' | 'good' | 'fair' | 'poor';
  sideEffects?: string[];
}

export interface ComplicationImpact {
  maternalRisk: 'low' | 'moderate' | 'high';
  fetalRisk: 'low' | 'moderate' | 'high';
  deliveryImpact: string[];
  longTermEffects?: string[];
}

// ============================================================================
// DELIVERY & POSTPARTUM TYPES
// ============================================================================

export interface DeliveryInfo extends BaseEntity {
  pregnancyId: string;
  deliveryDate: Date;
  gestationalAgeAtDelivery: number;
  deliveryType: DeliveryType;
  laborDuration?: number; // in hours
  complications: DeliveryComplication[];
  medications: DeliveryMedication[];
  babyInfo: BabyInfo[];
  placentaInfo: PlacentaInfo;
  postpartumCourse: PostpartumCourse;
}

export enum DeliveryType {
  VAGINAL_SPONTANEOUS = 'vaginal_spontaneous',
  VAGINAL_ASSISTED = 'vaginal_assisted',
  CESAREAN_ELECTIVE = 'cesarean_elective',
  CESAREAN_EMERGENCY = 'cesarean_emergency'
}

export interface DeliveryComplication {
  type: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  treatment: string;
  outcome: string;
}

export interface DeliveryMedication {
  name: string;
  type: 'anesthesia' | 'analgesia' | 'antibiotic' | 'other';
  dosage: string;
  route: string;
  timing: string;
}

export interface BabyInfo {
  birthOrder: number; // for multiples
  weight: number; // in grams
  length: number; // in cm
  headCircumference: number; // in cm
  apgarScores: ApgarScore[];
  complications: string[];
  neonatalCare: string[];
}

export interface ApgarScore {
  timePoint: 1 | 5 | 10; // minutes after birth
  score: number; // 0-10
  components: {
    heartRate: number;
    respiratoryEffort: number;
    muscleTone: number;
    reflexResponse: number;
    color: number;
  };
}

export interface PlacentaInfo {
  weight: number; // in grams
  appearance: string;
  abnormalities?: string[];
  pathologyRequired: boolean;
}

export interface PostpartumCourse {
  lengthOfStay: number; // in hours
  complications: PostpartumComplication[];
  breastfeedingStatus: BreastfeedingStatus;
  dischargeInstructions: string[];
  followUpScheduled: Date;
}

export interface PostpartumComplication {
  type: string;
  severity: 'mild' | 'moderate' | 'severe';
  treatment: string;
  resolved: boolean;
}

export enum BreastfeedingStatus {
  EXCLUSIVE = 'exclusive',
  PARTIAL = 'partial',
  FORMULA_ONLY = 'formula_only',
  NOT_ATTEMPTED = 'not_attempted'
}

// ============================================================================
// NOTIFICATION & COMMUNICATION TYPES
// ============================================================================

export interface Notification extends BaseEntity {
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  status: NotificationStatus;
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
  actionRequired: boolean;
  actionUrl?: string;
  expiresAt?: Date;
}

export enum NotificationType {
  APPOINTMENT_REMINDER = 'appointment_reminder',
  MEDICATION_REMINDER = 'medication_reminder',
  VITAL_SIGNS_DUE = 'vital_signs_due',
  HIGH_RISK_ALERT = 'high_risk_alert',
  LAB_RESULTS = 'lab_results',
  EMERGENCY_ALERT = 'emergency_alert',
  EDUCATIONAL_CONTENT = 'educational_content',
  SYSTEM_UPDATE = 'system_update',
  CARE_PLAN_UPDATE = 'care_plan_update'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
  EMERGENCY = 'emergency'
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
  PHONE_CALL = 'phone_call'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// ============================================================================
// INTEGRATION & EHR TYPES
// ============================================================================

export interface EHRIntegration extends BaseEntity {
  providerId: string;
  ehrSystem: EHRSystem;
  connectionStatus: ConnectionStatus;
  lastSyncAt?: Date;
  syncFrequency: number; // in minutes
  dataMapping: EHRDataMapping;
  credentials: EHRCredentials;
  errorLog: IntegrationError[];
}

export enum EHRSystem {
  EPIC = 'epic',
  CERNER = 'cerner',
  ALLSCRIPTS = 'allscripts',
  ATHENAHEALTH = 'athenahealth',
  ECLINICALWORKS = 'eclinicalworks',
  NEXTGEN = 'nextgen',
  OTHER = 'other'
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  PENDING = 'pending',
  EXPIRED = 'expired'
}

export interface EHRDataMapping {
  patientMapping: Record<string, string>;
  appointmentMapping: Record<string, string>;
  labMapping: Record<string, string>;
  medicationMapping: Record<string, string>;
  customFields: Record<string, string>;
}

export interface EHRCredentials {
  clientId: string;
  clientSecret: string; // encrypted
  accessToken?: string; // encrypted
  refreshToken?: string; // encrypted
  tokenExpiresAt?: Date;
  scope: string[];
}

export interface IntegrationError {
  timestamp: Date;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  resolved: boolean;
  resolvedAt?: Date;
}

// ============================================================================
// DEVICE INTEGRATION TYPES
// ============================================================================

export interface DeviceIntegration extends BaseEntity {
  patientId: string;
  deviceType: DeviceType;
  deviceId: string;
  manufacturer: string;
  model: string;
  firmwareVersion?: string;
  connectionStatus: ConnectionStatus;
  lastDataReceived?: Date;
  batteryLevel?: number;
  dataTypes: DeviceDataType[];
  calibrationDate?: Date;
  calibrationDue?: Date;
}

export enum DeviceType {
  BLOOD_PRESSURE_MONITOR = 'blood_pressure_monitor',
  GLUCOSE_METER = 'glucose_meter',
  WEIGHT_SCALE = 'weight_scale',
  PULSE_OXIMETER = 'pulse_oximeter',
  THERMOMETER = 'thermometer',
  FETAL_DOPPLER = 'fetal_doppler',
  WEARABLE_FITNESS = 'wearable_fitness',
  SMART_WATCH = 'smart_watch',
  CONTINUOUS_GLUCOSE_MONITOR = 'continuous_glucose_monitor'
}

export enum DeviceDataType {
  BLOOD_PRESSURE = 'blood_pressure',
  HEART_RATE = 'heart_rate',
  WEIGHT = 'weight',
  GLUCOSE = 'glucose',
  TEMPERATURE = 'temperature',
  OXYGEN_SATURATION = 'oxygen_saturation',
  STEPS = 'steps',
  SLEEP = 'sleep',
  ACTIVITY = 'activity',
  FETAL_HEART_RATE = 'fetal_heart_rate'
}

// ============================================================================
// ANALYTICS & REPORTING TYPES
// ============================================================================

export interface AnalyticsReport extends BaseEntity {
  type: ReportType;
  generatedBy: string;
  generatedFor?: string; // patient or provider ID
  dateRange: DateRange;
  parameters: Record<string, any>;
  data: ReportData;
  insights: ReportInsight[];
  recommendations: string[];
  format: ReportFormat;
  status: ReportStatus;
}

export enum ReportType {
  PATIENT_SUMMARY = 'patient_summary',
  RISK_ASSESSMENT_TREND = 'risk_assessment_trend',
  PROVIDER_DASHBOARD = 'provider_dashboard',
  POPULATION_HEALTH = 'population_health',
  QUALITY_METRICS = 'quality_metrics',
  CLINICAL_OUTCOMES = 'clinical_outcomes',
  DEVICE_UTILIZATION = 'device_utilization',
  MEDICATION_ADHERENCE = 'medication_adherence'
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ReportData {
  summary: Record<string, any>;
  details: Record<string, any>[];
  charts: ChartData[];
  tables: TableData[];
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area';
  title: string;
  data: any[];
  xAxis: string;
  yAxis: string;
  series: string[];
}

export interface TableData {
  title: string;
  headers: string[];
  rows: any[][];
  sortable: boolean;
  filterable: boolean;
}

export interface ReportInsight {
  type: 'trend' | 'anomaly' | 'correlation' | 'prediction';
  title: string;
  description: string;
  significance: 'low' | 'medium' | 'high';
  confidence: number; // 0-1
  actionable: boolean;
}

export enum ReportFormat {
  JSON = 'json',
  PDF = 'pdf',
  CSV = 'csv',
  EXCEL = 'excel',
  HTML = 'html'
}

export enum ReportStatus {
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  timestamp: Date;
  requestId: string;
  pagination?: PaginationInfo;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'article' | 'video' | 'pdf' | 'website' | 'app';
  language: string;
  readingLevel: 'basic' | 'intermediate' | 'advanced';
  tags: string[];
}

export interface ChronicCondition {
  condition: string;
  diagnosedDate: Date;
  severity: 'mild' | 'moderate' | 'severe';
  controlled: boolean;
  medications: string[];
}

export interface Surgery {
  procedure: string;
  date: Date;
  surgeon: string;
  complications?: string[];
  notes?: string;
}

export interface FamilyHistoryItem {
  relationship: string;
  condition: string;
  ageAtOnset?: number;
  notes?: string;
}

export interface PregnancyMedication {
  medicationId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  indication: string;
  prescribedBy: string;
  fdaCategory: 'A' | 'B' | 'C' | 'D' | 'X';
  safetyNotes?: string[];
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export * from './api';
export * from './events';
export * from './validation';