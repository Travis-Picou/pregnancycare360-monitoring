/**
 * PregnancyCare 360 - End-to-End Tests
 * 
 * Comprehensive E2E test suite covering complete pregnancy monitoring workflows
 * from patient registration through delivery with >90% coverage target.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const AI_ML_BASE_URL = process.env.AI_ML_BASE_URL || 'http://localhost:8000';

// Test data generators
const generatePatientData = () => ({
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  phone: faker.phone.number(),
  dateOfBirth: faker.date.birthdate({ min: 18, max: 45, mode: 'age' }).toISOString().split('T')[0],
  emergencyContact: {
    name: faker.person.fullName(),
    relationship: 'spouse',
    phone: faker.phone.number()
  }
});

const generateProviderData = () => ({
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  npiNumber: faker.string.numeric(10),
  licenseNumber: faker.string.alphanumeric(8),
  specialty: 'Obstetrics and Gynecology',
  credentials: ['MD', 'FACOG']
});

const generateVitalSigns = (riskLevel: 'normal' | 'elevated' | 'high' = 'normal') => {
  const baseVitals = {
    bloodPressure: { systolic: 120, diastolic: 80 },
    heartRate: 72,
    weight: 65.5,
    temperature: 36.8,
    glucoseLevel: 95,
    fetalHeartRate: 140,
    oxygenSaturation: 98
  };

  if (riskLevel === 'elevated') {
    baseVitals.bloodPressure = { systolic: 135, diastolic: 88 };
    baseVitals.glucoseLevel = 125;
  } else if (riskLevel === 'high') {
    baseVitals.bloodPressure = { systolic: 155, diastolic: 98 };
    baseVitals.glucoseLevel = 165;
    baseVitals.fetalHeartRate = 105;
  }

  return baseVitals;
};

// Page Object Models
class LoginPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto(`${BASE_URL}/login`);
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL('**/dashboard');
  }
}

class PatientDashboard {
  constructor(private page: Page) {}

  async waitForLoad() {
    await this.page.waitForSelector('[data-testid="patient-dashboard"]');
  }

  async getRiskScore() {
    const riskScoreElement = await this.page.locator('[data-testid="risk-score"]');
    return await riskScoreElement.textContent();
  }

  async getGestationalAge() {
    const gestationalAgeElement = await this.page.locator('[data-testid="gestational-age"]');
    return await gestationalAgeElement.textContent();
  }

  async navigateToVitalSigns() {
    await this.page.click('[data-testid="vital-signs-tab"]');
    await this.page.waitForSelector('[data-testid="vital-signs-page"]');
  }

  async navigateToAppointments() {
    await this.page.click('[data-testid="appointments-tab"]');
    await this.page.waitForSelector('[data-testid="appointments-page"]');
  }
}

class VitalSignsPage {
  constructor(private page: Page) {}

  async recordVitalSigns(vitals: any) {
    await this.page.click('[data-testid="record-vitals-button"]');
    
    // Fill vital signs form
    await this.page.fill('[data-testid="systolic-bp"]', vitals.bloodPressure.systolic.toString());
    await this.page.fill('[data-testid="diastolic-bp"]', vitals.bloodPressure.diastolic.toString());
    await this.page.fill('[data-testid="heart-rate"]', vitals.heartRate.toString());
    await this.page.fill('[data-testid="weight"]', vitals.weight.toString());
    await this.page.fill('[data-testid="temperature"]', vitals.temperature.toString());
    await this.page.fill('[data-testid="glucose-level"]', vitals.glucoseLevel.toString());
    await this.page.fill('[data-testid="fetal-heart-rate"]', vitals.fetalHeartRate.toString());
    
    await this.page.click('[data-testid="save-vitals-button"]');
    await this.page.waitForSelector('[data-testid="vitals-saved-message"]');
  }

  async getLatestVitalSigns() {
    const vitalsRow = this.page.locator('[data-testid="latest-vitals-row"]').first();
    return {
      bloodPressure: await vitalsRow.locator('[data-testid="bp-value"]').textContent(),
      heartRate: await vitalsRow.locator('[data-testid="hr-value"]').textContent(),
      weight: await vitalsRow.locator('[data-testid="weight-value"]').textContent(),
      recordedAt: await vitalsRow.locator('[data-testid="recorded-at"]').textContent()
    };
  }
}

class ProviderDashboard {
  constructor(private page: Page) {}

  async waitForLoad() {
    await this.page.waitForSelector('[data-testid="provider-dashboard"]');
  }

  async getPatientList() {
    await this.page.waitForSelector('[data-testid="patient-list"]');
    const patientRows = await this.page.locator('[data-testid="patient-row"]').all();
    
    const patients = [];
    for (const row of patientRows) {
      patients.push({
        name: await row.locator('[data-testid="patient-name"]').textContent(),
        riskLevel: await row.locator('[data-testid="risk-level"]').textContent(),
        gestationalAge: await row.locator('[data-testid="gestational-age"]').textContent()
      });
    }
    
    return patients;
  }

  async viewPatientDetails(patientName: string) {
    await this.page.click(`[data-testid="patient-row"]:has-text("${patientName}") [data-testid="view-details-button"]`);
    await this.page.waitForSelector('[data-testid="patient-details-modal"]');
  }

  async getRiskAssessmentDetails() {
    const riskDetails = await this.page.locator('[data-testid="risk-assessment-details"]');
    return {
      overallScore: await riskDetails.locator('[data-testid="overall-risk-score"]').textContent(),
      preeclampsiaRisk: await riskDetails.locator('[data-testid="preeclampsia-risk"]').textContent(),
      gestationalDiabetesRisk: await riskDetails.locator('[data-testid="gd-risk"]').textContent(),
      pretermBirthRisk: await riskDetails.locator('[data-testid="preterm-risk"]').textContent()
    };
  }
}

// Test Suite
test.describe('PregnancyCare 360 - Complete Pregnancy Monitoring Workflow', () => {
  let context: BrowserContext;
  let patientPage: Page;
  let providerPage: Page;
  let patientData: any;
  let providerData: any;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    patientPage = await context.newPage();
    providerPage = await context.newPage();
    
    patientData = generatePatientData();
    providerData = generateProviderData();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('User Registration and Authentication', () => {
    test('should register new patient successfully', async () => {
      await patientPage.goto(`${BASE_URL}/register/patient`);
      
      // Fill registration form
      await patientPage.fill('[data-testid="first-name"]', patientData.firstName);
      await patientPage.fill('[data-testid="last-name"]', patientData.lastName);
      await patientPage.fill('[data-testid="email"]', patientData.email);
      await patientPage.fill('[data-testid="password"]', 'SecurePassword123!');
      await patientPage.fill('[data-testid="confirm-password"]', 'SecurePassword123!');
      await patientPage.fill('[data-testid="phone"]', patientData.phone);
      await patientPage.fill('[data-testid="date-of-birth"]', patientData.dateOfBirth);
      
      // Emergency contact
      await patientPage.fill('[data-testid="emergency-contact-name"]', patientData.emergencyContact.name);
      await patientPage.fill('[data-testid="emergency-contact-phone"]', patientData.emergencyContact.phone);
      await patientPage.selectOption('[data-testid="emergency-contact-relationship"]', patientData.emergencyContact.relationship);
      
      await patientPage.click('[data-testid="register-button"]');
      
      // Should redirect to email verification
      await expect(patientPage).toHaveURL(/.*\/verify-email/);
      await expect(patientPage.locator('[data-testid="verification-message"]')).toContainText('verification email has been sent');
    });

    test('should register new provider successfully', async () => {
      await providerPage.goto(`${BASE_URL}/register/provider`);
      
      // Fill provider registration form
      await providerPage.fill('[data-testid="first-name"]', providerData.firstName);
      await providerPage.fill('[data-testid="last-name"]', providerData.lastName);
      await providerPage.fill('[data-testid="email"]', providerData.email);
      await providerPage.fill('[data-testid="password"]', 'SecurePassword123!');
      await providerPage.fill('[data-testid="npi-number"]', providerData.npiNumber);
      await providerPage.fill('[data-testid="license-number"]', providerData.licenseNumber);
      await providerPage.selectOption('[data-testid="specialty"]', providerData.specialty);
      
      await providerPage.click('[data-testid="register-button"]');
      
      // Should redirect to pending approval page
      await expect(providerPage).toHaveURL(/.*\/pending-approval/);
      await expect(providerPage.locator('[data-testid="approval-message"]')).toContainText('account is pending approval');
    });

    test('should login patient successfully after verification', async () => {
      // Simulate email verification (in real test, would use test email service)
      await patientPage.goto(`${BASE_URL}/verify-email?token=test-verification-token`);
      
      const loginPage = new LoginPage(patientPage);
      await loginPage.navigate();
      await loginPage.login(patientData.email, 'SecurePassword123!');
      
      // Should be on dashboard
      const dashboard = new PatientDashboard(patientPage);
      await dashboard.waitForLoad();
      
      await expect(patientPage.locator('[data-testid="welcome-message"]')).toContainText(`Welcome, ${patientData.firstName}`);
    });
  });

  test.describe('Pregnancy Setup and Initial Assessment', () => {
    test('should create new pregnancy record', async () => {
      // Navigate to pregnancy setup
      await patientPage.click('[data-testid="setup-pregnancy-button"]');
      await patientPage.waitForSelector('[data-testid="pregnancy-setup-form"]');
      
      // Fill pregnancy details
      const lmpDate = new Date();
      lmpDate.setDate(lmpDate.getDate() - 140); // 20 weeks ago
      const dueDateCalculated = new Date(lmpDate);
      dueDateCalculated.setDate(dueDateCalculated.getDate() + 280); // 40 weeks from LMP
      
      await patientPage.fill('[data-testid="lmp-date"]', lmpDate.toISOString().split('T')[0]);
      await patientPage.fill('[data-testid="due-date"]', dueDateCalculated.toISOString().split('T')[0]);
      await patientPage.selectOption('[data-testid="conception-type"]', 'natural');
      
      // Medical history
      await patientPage.check('[data-testid="previous-pregnancy-yes"]');
      await patientPage.fill('[data-testid="previous-pregnancies-count"]', '1');
      await patientPage.check('[data-testid="family-history-diabetes"]');
      
      await patientPage.click('[data-testid="create-pregnancy-button"]');
      
      // Should show pregnancy created successfully
      await expect(patientPage.locator('[data-testid="pregnancy-created-message"]')).toBeVisible();
      
      // Should redirect to dashboard with pregnancy info
      const dashboard = new PatientDashboard(patientPage);
      await dashboard.waitForLoad();
      
      const gestationalAge = await dashboard.getGestationalAge();
      expect(gestationalAge).toContain('20'); // Should show ~20 weeks
    });

    test('should perform initial risk assessment', async () => {
      // Risk assessment should be automatically triggered
      await patientPage.waitForSelector('[data-testid="initial-risk-assessment"]', { timeout: 10000 });
      
      const dashboard = new PatientDashboard(patientPage);
      const riskScore = await dashboard.getRiskScore();
      
      // Should have a risk score (0-100)
      expect(riskScore).toMatch(/\d+/);
      
      // Should show risk level
      const riskLevel = await patientPage.locator('[data-testid="risk-level"]').textContent();
      expect(['low', 'moderate', 'high', 'critical']).toContain(riskLevel?.toLowerCase());
    });
  });

  test.describe('Vital Signs Recording and Monitoring', () => {
    test('should record normal vital signs', async () => {
      const dashboard = new PatientDashboard(patientPage);
      await dashboard.navigateToVitalSigns();
      
      const vitalSignsPage = new VitalSignsPage(patientPage);
      const normalVitals = generateVitalSigns('normal');
      
      await vitalSignsPage.recordVitalSigns(normalVitals);
      
      // Verify vitals were saved
      const latestVitals = await vitalSignsPage.getLatestVitalSigns();
      expect(latestVitals.bloodPressure).toContain('120/80');
      expect(latestVitals.heartRate).toContain('72');
    });

    test('should trigger alerts for high-risk vital signs', async () => {
      const vitalSignsPage = new VitalSignsPage(patientPage);
      const highRiskVitals = generateVitalSigns('high');
      
      await vitalSignsPage.recordVitalSigns(highRiskVitals);
      
      // Should show alert notification
      await expect(patientPage.locator('[data-testid="high-risk-alert"]')).toBeVisible({ timeout: 5000 });
      
      // Alert should contain specific warnings
      const alertText = await patientPage.locator('[data-testid="alert-message"]').textContent();
      expect(alertText).toContain('blood pressure');
      expect(alertText).toContain('fetal heart rate');
    });

    test('should update risk assessment after vital signs', async () => {
      // Wait for risk assessment to be updated
      await patientPage.waitForTimeout(3000); // Allow time for AI processing
      
      const dashboard = new PatientDashboard(patientPage);
      const updatedRiskScore = await dashboard.getRiskScore();
      
      // Risk score should be higher due to abnormal vitals
      const riskScoreNumber = parseInt(updatedRiskScore || '0');
      expect(riskScoreNumber).toBeGreaterThan(50); // Should be elevated
      
      // Should show updated risk level
      const riskLevel = await patientPage.locator('[data-testid="risk-level"]').textContent();
      expect(['high', 'critical']).toContain(riskLevel?.toLowerCase());
    });
  });

  test.describe('Provider Workflow and Care Coordination', () => {
    test('should login provider and view patient list', async () => {
      // Simulate provider approval (in real test, would be done by admin)
      await providerPage.goto(`${BASE_URL}/admin/approve-provider?id=test-provider-id`);
      
      const loginPage = new LoginPage(providerPage);
      await loginPage.navigate();
      await loginPage.login(providerData.email, 'SecurePassword123!');
      
      const providerDashboard = new ProviderDashboard(providerPage);
      await providerDashboard.waitForLoad();
      
      // Should see patient list
      const patients = await providerDashboard.getPatientList();
      expect(patients.length).toBeGreaterThan(0);
      
      // Should see our test patient
      const testPatient = patients.find(p => p.name?.includes(patientData.firstName));
      expect(testPatient).toBeDefined();
      expect(testPatient?.riskLevel).toBe('high'); // From previous high-risk vitals
    });

    test('should view detailed patient risk assessment', async () => {
      const providerDashboard = new ProviderDashboard(providerPage);
      await providerDashboard.viewPatientDetails(`${patientData.firstName} ${patientData.lastName}`);
      
      const riskDetails = await providerDashboard.getRiskAssessmentDetails();
      
      // Should have detailed risk scores
      expect(riskDetails.overallScore).toMatch(/\d+/);
      expect(riskDetails.preeclampsiaRisk).toMatch(/\d+/);
      expect(riskDetails.gestationalDiabetesRisk).toMatch(/\d+/);
      expect(riskDetails.pretermBirthRisk).toMatch(/\d+/);
    });

    test('should schedule follow-up appointment', async () => {
      // Click schedule appointment button
      await providerPage.click('[data-testid="schedule-appointment-button"]');
      await providerPage.waitForSelector('[data-testid="appointment-form"]');
      
      // Fill appointment details
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 7); // Next week
      
      await providerPage.selectOption('[data-testid="appointment-type"]', 'high_risk_monitoring');
      await providerPage.fill('[data-testid="appointment-date"]', appointmentDate.toISOString().split('T')[0]);
      await providerPage.fill('[data-testid="appointment-time"]', '10:00');
      await providerPage.fill('[data-testid="appointment-reason"]', 'High-risk monitoring due to elevated blood pressure and abnormal fetal heart rate');
      
      await providerPage.click('[data-testid="schedule-button"]');
      
      // Should show appointment scheduled confirmation
      await expect(providerPage.locator('[data-testid="appointment-scheduled-message"]')).toBeVisible();
    });
  });

  test.describe('Notifications and Alerts', () => {
    test('should receive appointment reminder notification', async () => {
      // Switch back to patient page
      await patientPage.bringToFront();
      
      // Check notifications
      await patientPage.click('[data-testid="notifications-button"]');
      await patientPage.waitForSelector('[data-testid="notifications-list"]');
      
      // Should have appointment reminder
      const notifications = await patientPage.locator('[data-testid="notification-item"]').all();
      expect(notifications.length).toBeGreaterThan(0);
      
      const appointmentNotification = notifications.find(async (notification) => {
        const text = await notification.textContent();
        return text?.includes('appointment') && text?.includes('scheduled');
      });
      
      expect(appointmentNotification).toBeDefined();
    });

    test('should receive high-risk alert notification', async () => {
      // Should have high-risk alert notification
      const highRiskNotification = await patientPage.locator('[data-testid="notification-item"]:has-text("high risk")').first();
      await expect(highRiskNotification).toBeVisible();
      
      // Notification should have action button
      const actionButton = highRiskNotification.locator('[data-testid="notification-action"]');
      await expect(actionButton).toBeVisible();
      
      // Click to view details
      await actionButton.click();
      await expect(patientPage.locator('[data-testid="risk-details-modal"]')).toBeVisible();
    });
  });

  test.describe('Mobile App Integration', () => {
    test('should sync vital signs from mobile app', async () => {
      // Simulate mobile app API call
      const mobileVitals = generateVitalSigns('normal');
      
      const response = await patientPage.request.post(`${API_BASE_URL}/api/patients/test-patient-id/vital-signs`, {
        data: {
          ...mobileVitals,
          source: 'mobile_app',
          deviceId: 'test-mobile-device'
        },
        headers: {
          'Authorization': 'Bearer test-mobile-token',
          'Content-Type': 'application/json'
        }
      });
      
      expect(response.status()).toBe(201);
      
      // Refresh patient dashboard
      await patientPage.reload();
      
      const dashboard = new PatientDashboard(patientPage);
      await dashboard.navigateToVitalSigns();
      
      // Should see mobile-synced vitals
      const vitalSignsPage = new VitalSignsPage(patientPage);
      const latestVitals = await vitalSignsPage.getLatestVitalSigns();
      expect(latestVitals.bloodPressure).toContain('120/80');
    });
  });

  test.describe('AI/ML Risk Assessment Integration', () => {
    test('should provide accurate risk predictions', async () => {
      // Test AI/ML service directly
      const riskAssessmentData = {
        patient_id: 'test-patient-123',
        pregnancy_id: 'test-pregnancy-123',
        patient_data: {
          age: 28,
          bmi: 24.5,
          gestational_age: 20.0,
          previous_pregnancies: 1,
          previous_complications: [],
          chronic_conditions: [],
          medications: ['prenatal_vitamins'],
          family_history: ['diabetes']
        },
        vital_signs: generateVitalSigns('normal'),
        lab_results: {
          hemoglobin: 12.5,
          glucose_fasting: 92,
          protein_urine: 0.1
        }
      };
      
      const response = await patientPage.request.post(`${AI_ML_BASE_URL}/risk-assessment`, {
        data: riskAssessmentData,
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      });
      
      expect(response.status()).toBe(200);
      
      const riskAssessment = await response.json();
      expect(riskAssessment.overall_risk_score).toBeGreaterThanOrEqual(0);
      expect(riskAssessment.overall_risk_score).toBeLessThanOrEqual(100);
      expect(riskAssessment.risk_level).toMatch(/^(low|moderate|high|critical)$/);
      expect(riskAssessment.risk_scores).toHaveLength(3); // Three conditions
      expect(riskAssessment.confidence).toBeGreaterThan(0.7);
    });

    test('should provide early detection predictions', async () => {
      const predictionData = {
        patient_id: 'test-patient-123',
        pregnancy_id: 'test-pregnancy-123',
        patient_data: {
          age: 35,
          bmi: 28.0,
          gestational_age: 24.0,
          previous_pregnancies: 2,
          previous_complications: ['gestational_diabetes'],
          chronic_conditions: ['hypertension'],
          medications: ['prenatal_vitamins', 'low_dose_aspirin'],
          family_history: ['preeclampsia', 'diabetes']
        },
        vital_signs: generateVitalSigns('elevated')
      };
      
      const response = await patientPage.request.post(`${AI_ML_BASE_URL}/predict/early-detection`, {
        data: predictionData,
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      });
      
      expect(response.status()).toBe(200);
      
      const prediction = await response.json();
      expect(prediction.success).toBe(true);
      expect(prediction.data.predictions).toHaveLength(14); // 14-day predictions
      expect(prediction.data.detection_window).toBe('14 days');
      
      // Each prediction should have required fields
      prediction.data.predictions.forEach((pred: any) => {
        expect(pred.days_ahead).toBeGreaterThan(0);
        expect(pred.days_ahead).toBeLessThanOrEqual(14);
        expect(pred.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(pred.overall_probability).toBeGreaterThanOrEqual(0);
        expect(pred.overall_probability).toBeLessThanOrEqual(1);
        expect(pred.confidence).toBeGreaterThan(0);
      });
    });
  });

  test.describe('Data Export and Reporting', () => {
    test('should export patient data', async () => {
      await patientPage.goto(`${BASE_URL}/profile/data-export`);
      
      // Request data export
      await patientPage.click('[data-testid="export-data-button"]');
      await patientPage.selectOption('[data-testid="export-format"]', 'pdf');
      await patientPage.check('[data-testid="include-vitals"]');
      await patientPage.check('[data-testid="include-assessments"]');
      await patientPage.check('[data-testid="include-appointments"]');
      
      await patientPage.click('[data-testid="generate-export-button"]');
      
      // Should show export in progress
      await expect(patientPage.locator('[data-testid="export-progress"]')).toBeVisible();
      
      // Wait for export completion
      await expect(patientPage.locator('[data-testid="export-ready"]')).toBeVisible({ timeout: 30000 });
      
      // Should have download link
      const downloadLink = patientPage.locator('[data-testid="download-export-link"]');
      await expect(downloadLink).toBeVisible();
    });

    test('should generate provider analytics report', async () => {
      await providerPage.bringToFront();
      await providerPage.goto(`${BASE_URL}/provider/analytics`);
      
      // Generate population health report
      await providerPage.click('[data-testid="generate-report-button"]');
      await providerPage.selectOption('[data-testid="report-type"]', 'population_health');
      
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      await providerPage.fill('[data-testid="start-date"]', startDate.toISOString().split('T')[0]);
      await providerPage.fill('[data-testid="end-date"]', new Date().toISOString().split('T')[0]);
      
      await providerPage.click('[data-testid="generate-analytics-button"]');
      
      // Should show analytics dashboard
      await expect(providerPage.locator('[data-testid="analytics-dashboard"]')).toBeVisible({ timeout: 15000 });
      
      // Should have key metrics
      await expect(providerPage.locator('[data-testid="total-patients"]')).toBeVisible();
      await expect(providerPage.locator('[data-testid="high-risk-patients"]')).toBeVisible();
      await expect(providerPage.locator('[data-testid="average-risk-score"]')).toBeVisible();
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle concurrent vital signs recording', async () => {
      const promises = [];
      
      // Simulate 5 concurrent vital signs recordings
      for (let i = 0; i < 5; i++) {
        const vitals = generateVitalSigns('normal');
        vitals.recordedAt = new Date().toISOString();
        
        const promise = patientPage.request.post(`${API_BASE_URL}/api/patients/test-patient-id/vital-signs`, {
          data: vitals,
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        });
        
        promises.push(promise);
      }
      
      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status()).toBe(201);
      });
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      // Perform multiple operations
      const dashboard = new PatientDashboard(patientPage);
      await dashboard.waitForLoad();
      await dashboard.navigateToVitalSigns();
      await dashboard.navigateToAppointments();
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds
    });
  });

  test.describe('Security and Privacy', () => {
    test('should enforce authentication on protected routes', async () => {
      const newPage = await context.newPage();
      
      // Try to access protected route without authentication
      const response = await newPage.goto(`${BASE_URL}/dashboard`);
      
      // Should redirect to login
      expect(newPage.url()).toContain('/login');
      
      await newPage.close();
    });

    test('should prevent unauthorized data access', async () => {
      // Try to access another patient's data
      const response = await patientPage.request.get(`${API_BASE_URL}/api/patients/different-patient-id`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      expect(response.status()).toBe(403); // Forbidden
    });

    test('should sanitize user inputs', async () => {
      const vitalSignsPage = new VitalSignsPage(patientPage);
      await vitalSignsPage.recordVitalSigns({
        bloodPressure: { systolic: '<script>alert("xss")</script>', diastolic: 80 },
        heartRate: 72,
        weight: 65.5,
        temperature: 36.8,
        glucoseLevel: 95,
        fetalHeartRate: 140,
        oxygenSaturation: 98
      });
      
      // Should not execute script or show XSS alert
      const alerts = await patientPage.locator('.alert').count();
      expect(alerts).toBe(0);
    });
  });
});

// Performance monitoring
test.describe('Performance Monitoring', () => {
  test('should track Core Web Vitals', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Measure performance metrics
    const performanceMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics: any = {};
          
          entries.forEach((entry) => {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              metrics.loadTime = navEntry.loadEventEnd - navEntry.loadEventStart;
              metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart;
            }
          });
          
          resolve(metrics);
        }).observe({ entryTypes: ['navigation'] });
      });
    });
    
    // Assert performance thresholds
    expect(performanceMetrics.loadTime).toBeLessThan(3000); // 3 seconds
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // 2 seconds
  });
});