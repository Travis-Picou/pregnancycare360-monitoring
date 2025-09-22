-- PregnancyCare 360 - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Description: Creates the foundational database schema for the PregnancyCare 360 platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for location data (if needed)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- USERS & AUTHENTICATION TABLES
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('patient', 'provider', 'admin', 'clinical_staff', 'support')),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    phone_number VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- User sessions for JWT token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    device_info JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- ============================================================================
-- PATIENT TABLES
-- ============================================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE NOT NULL,
    medical_record_number VARCHAR(50),
    emergency_contact JSONB NOT NULL,
    insurance_info JSONB,
    medical_history JSONB DEFAULT '{}',
    allergies JSONB DEFAULT '[]',
    medications JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_mrn ON patients(medical_record_number);

-- ============================================================================
-- PROVIDER TABLES
-- ============================================================================

CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    npi_number VARCHAR(20) UNIQUE NOT NULL,
    license_number VARCHAR(50) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    credentials TEXT[],
    practice_id UUID,
    availability JSONB DEFAULT '[]',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_providers_user_id ON providers(user_id);
CREATE INDEX idx_providers_npi ON providers(npi_number);
CREATE INDEX idx_providers_specialty ON providers(specialty);

-- Provider-Patient relationships
CREATE TABLE provider_patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) DEFAULT 'primary',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_provider_patients_active ON provider_patients(provider_id, patient_id) 
WHERE ended_at IS NULL;

-- ============================================================================
-- PREGNANCY TABLES
-- ============================================================================

CREATE TABLE pregnancies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated', 'miscarriage')),
    last_menstrual_period DATE NOT NULL,
    estimated_due_date DATE NOT NULL,
    gestational_age DECIMAL(4,1) NOT NULL DEFAULT 0,
    conception_type VARCHAR(50) DEFAULT 'natural' CHECK (conception_type IN ('natural', 'ivf', 'iui', 'other_art')),
    is_high_risk BOOLEAN DEFAULT false,
    risk_factors JSONB DEFAULT '[]',
    current_risk_score INTEGER DEFAULT 0 CHECK (current_risk_score >= 0 AND current_risk_score <= 100),
    delivery_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_pregnancies_patient_id ON pregnancies(patient_id);
CREATE INDEX idx_pregnancies_provider_id ON pregnancies(provider_id);
CREATE INDEX idx_pregnancies_status ON pregnancies(status);
CREATE INDEX idx_pregnancies_due_date ON pregnancies(estimated_due_date);

-- ============================================================================
-- VITAL SIGNS TABLES
-- ============================================================================

CREATE TABLE vital_signs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pregnancy_id UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    recorded_by UUID NOT NULL REFERENCES users(id),
    source VARCHAR(50) NOT NULL DEFAULT 'manual_entry' CHECK (source IN ('manual_entry', 'wearable_device', 'home_monitor', 'clinical_device', 'mobile_app', 'provider_entry')),
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    blood_pressure_pulse INTEGER,
    blood_pressure_position VARCHAR(20),
    heart_rate INTEGER,
    weight DECIMAL(5,2),
    temperature DECIMAL(4,1),
    oxygen_saturation INTEGER,
    glucose_level INTEGER,
    fetal_heart_rate INTEGER,
    fetal_movement JSONB,
    symptoms JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vital_signs_pregnancy_id ON vital_signs(pregnancy_id);
CREATE INDEX idx_vital_signs_recorded_at ON vital_signs(recorded_at);
CREATE INDEX idx_vital_signs_source ON vital_signs(source);

-- ============================================================================
-- RISK ASSESSMENT TABLES
-- ============================================================================

CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id VARCHAR(100) UNIQUE NOT NULL,
    pregnancy_id UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    overall_risk_score INTEGER NOT NULL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
    risk_categories JSONB NOT NULL,
    predictions JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    model_version VARCHAR(50) NOT NULL,
    data_quality JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_assessments_pregnancy_id ON risk_assessments(pregnancy_id);
CREATE INDEX idx_risk_assessments_date ON risk_assessments(assessment_date);
CREATE INDEX idx_risk_assessments_risk_level ON risk_assessments(risk_level);
CREATE INDEX idx_risk_assessments_assessment_id ON risk_assessments(assessment_id);

-- ============================================================================
-- APPOINTMENT TABLES
-- ============================================================================

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pregnancy_id UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('routine_checkup', 'high_risk_monitoring', 'ultrasound', 'lab_work', 'consultation', 'emergency', 'telehealth', 'postpartum')),
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER NOT NULL DEFAULT 30, -- in minutes
    location JSONB NOT NULL,
    reason TEXT NOT NULL,
    notes TEXT,
    vitals_recorded_id UUID REFERENCES vital_signs(id),
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appointments_pregnancy_id ON appointments(pregnancy_id);
CREATE INDEX idx_appointments_provider_id ON appointments(provider_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);

-- ============================================================================
-- LAB RESULTS TABLES
-- ============================================================================

CREATE TABLE lab_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pregnancy_id UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
    ordered_by UUID NOT NULL REFERENCES providers(id),
    test_type VARCHAR(100) NOT NULL,
    collected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resulted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    results JSONB NOT NULL,
    interpretation JSONB NOT NULL,
    critical_values BOOLEAN DEFAULT false,
    follow_up_required BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lab_results_pregnancy_id ON lab_results(pregnancy_id);
CREATE INDEX idx_lab_results_test_type ON lab_results(test_type);
CREATE INDEX idx_lab_results_collected_at ON lab_results(collected_at);
CREATE INDEX idx_lab_results_critical ON lab_results(critical_values);

-- ============================================================================
-- ULTRASOUND TABLES
-- ============================================================================

CREATE TABLE ultrasounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pregnancy_id UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
    performed_by UUID NOT NULL REFERENCES providers(id),
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    gestational_age DECIMAL(4,1) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('dating', 'nuchal_translucency', 'anatomy_scan', 'growth_scan', 'biophysical_profile', 'doppler_studies', 'cervical_length')),
    measurements JSONB DEFAULT '[]',
    findings JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    interpretation TEXT NOT NULL,
    recommendations TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ultrasounds_pregnancy_id ON ultrasounds(pregnancy_id);
CREATE INDEX idx_ultrasounds_performed_at ON ultrasounds(performed_at);
CREATE INDEX idx_ultrasounds_type ON ultrasounds(type);

-- ============================================================================
-- COMPLICATIONS TABLES
-- ============================================================================

CREATE TABLE pregnancy_complications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pregnancy_id UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
    onset_date DATE NOT NULL,
    resolved_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'chronic')),
    description TEXT NOT NULL,
    treatment JSONB DEFAULT '[]',
    impact JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_complications_pregnancy_id ON pregnancy_complications(pregnancy_id);
CREATE INDEX idx_complications_type ON pregnancy_complications(type);
CREATE INDEX idx_complications_status ON pregnancy_complications(status);

-- ============================================================================
-- NOTIFICATION TABLES
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent', 'emergency')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    channels TEXT[] NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    action_required BOOLEAN DEFAULT false,
    action_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_scheduled_for ON notifications(scheduled_for);

-- ============================================================================
-- DEVICE INTEGRATION TABLES
-- ============================================================================

CREATE TABLE device_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    firmware_version VARCHAR(50),
    connection_status VARCHAR(20) NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'pending', 'expired')),
    last_data_received TIMESTAMP WITH TIME ZONE,
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    data_types TEXT[] NOT NULL,
    calibration_date DATE,
    calibration_due DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_integrations_patient_id ON device_integrations(patient_id);
CREATE INDEX idx_device_integrations_device_type ON device_integrations(device_type);
CREATE INDEX idx_device_integrations_status ON device_integrations(connection_status);

-- ============================================================================
-- EHR INTEGRATION TABLES
-- ============================================================================

CREATE TABLE ehr_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    ehr_system VARCHAR(50) NOT NULL CHECK (ehr_system IN ('epic', 'cerner', 'allscripts', 'athenahealth', 'eclinicalworks', 'nextgen', 'other')),
    connection_status VARCHAR(20) NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'pending', 'expired')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_frequency INTEGER DEFAULT 60, -- in minutes
    data_mapping JSONB NOT NULL,
    credentials JSONB NOT NULL, -- encrypted
    error_log JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ehr_integrations_provider_id ON ehr_integrations(provider_id);
CREATE INDEX idx_ehr_integrations_system ON ehr_integrations(ehr_system);
CREATE INDEX idx_ehr_integrations_status ON ehr_integrations(connection_status);

-- ============================================================================
-- ANALYTICS TABLES
-- ============================================================================

CREATE TABLE analytics_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    generated_by UUID NOT NULL REFERENCES users(id),
    generated_for UUID REFERENCES users(id),
    date_range JSONB NOT NULL,
    parameters JSONB DEFAULT '{}',
    data JSONB NOT NULL,
    insights JSONB DEFAULT '[]',
    recommendations TEXT[],
    format VARCHAR(20) NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'pdf', 'csv', 'excel', 'html')),
    status VARCHAR(20) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed', 'expired')),
    file_path TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_reports_type ON analytics_reports(type);
CREATE INDEX idx_analytics_reports_generated_by ON analytics_reports(generated_by);
CREATE INDEX idx_analytics_reports_status ON analytics_reports(status);

-- ============================================================================
-- AUDIT TABLES
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pregnancies_updated_at BEFORE UPDATE ON pregnancies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_complications_updated_at BEFORE UPDATE ON pregnancy_complications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_device_integrations_updated_at BEFORE UPDATE ON device_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ehr_integrations_updated_at BEFORE UPDATE ON ehr_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active pregnancies with patient and provider info
CREATE VIEW active_pregnancies AS
SELECT 
    p.id,
    p.patient_id,
    p.provider_id,
    p.gestational_age,
    p.estimated_due_date,
    p.current_risk_score,
    p.is_high_risk,
    pat.user_id as patient_user_id,
    u1.first_name as patient_first_name,
    u1.last_name as patient_last_name,
    u1.email as patient_email,
    prov.user_id as provider_user_id,
    u2.first_name as provider_first_name,
    u2.last_name as provider_last_name,
    u2.email as provider_email,
    p.created_at,
    p.updated_at
FROM pregnancies p
JOIN patients pat ON p.patient_id = pat.id
JOIN users u1 ON pat.user_id = u1.id
JOIN providers prov ON p.provider_id = prov.id
JOIN users u2 ON prov.user_id = u2.id
WHERE p.status = 'active' AND p.deleted_at IS NULL;

-- High-risk pregnancies requiring attention
CREATE VIEW high_risk_pregnancies AS
SELECT 
    ap.*,
    ra.overall_risk_score,
    ra.risk_level,
    ra.assessment_date as last_assessment_date
FROM active_pregnancies ap
LEFT JOIN LATERAL (
    SELECT * FROM risk_assessments 
    WHERE pregnancy_id = ap.id 
    ORDER BY assessment_date DESC 
    LIMIT 1
) ra ON true
WHERE ap.is_high_risk = true OR ra.risk_level IN ('high', 'critical');

-- Recent vital signs summary
CREATE VIEW recent_vital_signs AS
SELECT DISTINCT ON (vs.pregnancy_id)
    vs.pregnancy_id,
    vs.recorded_at,
    vs.blood_pressure_systolic,
    vs.blood_pressure_diastolic,
    vs.heart_rate,
    vs.weight,
    vs.glucose_level,
    vs.fetal_heart_rate,
    vs.source
FROM vital_signs vs
ORDER BY vs.pregnancy_id, vs.recorded_at DESC;

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Insert default admin user (password should be changed immediately)
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_verified)
VALUES ('admin@pregnancycare360.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9S2', 'System', 'Administrator', 'admin', true, true);

-- Insert sample notification types configuration
INSERT INTO notifications (recipient_id, type, priority, title, message, channels, status)
SELECT 
    u.id,
    'system_welcome',
    'low',
    'Welcome to PregnancyCare 360',
    'Welcome to PregnancyCare 360! Your account has been created successfully.',
    ARRAY['email', 'in_app'],
    'pending'
FROM users u WHERE u.role = 'admin';

COMMIT;