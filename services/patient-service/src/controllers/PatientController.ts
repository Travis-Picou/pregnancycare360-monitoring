/**
 * PregnancyCare 360 - Patient Service Controller
 * 
 * Handles all patient-related operations including registration,
 * profile management, vital signs tracking, and pregnancy monitoring.
 */

import { Request, Response, NextFunction } from 'express';
import { PatientService } from '../services/PatientService';
import { VitalSignsService } from '../services/VitalSignsService';
import { PregnancyService } from '../services/PregnancyService';
import { Logger } from '../../../../packages/shared/src/utils/logger';
import { 
  Patient, 
  VitalSigns, 
  Pregnancy, 
  ApiResponse,
  PregnancyStatus,
  DataSource 
} from '../../../../packages/shared/src/types';
import { validatePatientData, validateVitalSigns } from '../validators/PatientValidator';
import { NotificationService } from '../services/NotificationService';

const logger = new Logger('PatientController');

export class PatientController {
  private patientService: PatientService;
  private vitalSignsService: VitalSignsService;
  private pregnancyService: PregnancyService;
  private notificationService: NotificationService;

  constructor() {
    this.patientService = new PatientService();
    this.vitalSignsService = new VitalSignsService();
    this.pregnancyService = new PregnancyService();
    this.notificationService = new NotificationService();
  }

  // ============================================================================
  // PATIENT PROFILE MANAGEMENT
  // ============================================================================

  /**
   * Create a new patient profile
   */
  public createPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const patientData = req.body;

      logger.info('Creating new patient profile', { userId, requestId: req.headers['x-request-id'] });

      // Validate patient data
      const validation = validatePatientData(patientData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid patient data',
            details: validation.errors
          }
        } as ApiResponse);
        return;
      }

      // Create patient profile
      const patient = await this.patientService.createPatient({
        ...patientData,
        userId
      });

      // Send welcome notification
      await this.notificationService.sendWelcomeNotification(patient.id);

      logger.info('Patient profile created successfully', { 
        patientId: patient.id, 
        userId,
        requestId: req.headers['x-request-id']
      });

      res.status(201).json({
        success: true,
        data: patient,
        message: 'Patient profile created successfully'
      } as ApiResponse<Patient>);

    } catch (error) {
      logger.error('Error creating patient profile', { 
        error: error.message, 
        userId: req.headers['x-user-id'],
        requestId: req.headers['x-request-id']
      });
      next(error);
    }
  };

  /**
   * Get patient profile by ID
   */
  public getPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;
      const userId = req.headers['x-user-id'] as string;

      logger.debug('Fetching patient profile', { patientId, userId });

      const patient = await this.patientService.getPatientById(patientId);
      
      if (!patient) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PATIENT_NOT_FOUND',
            message: 'Patient not found'
          }
        } as ApiResponse);
        return;
      }

      // Check if user has access to this patient
      if (patient.userId !== userId && req.headers['x-user-role'] !== 'provider') {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to patient data'
          }
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: patient
      } as ApiResponse<Patient>);

    } catch (error) {
      logger.error('Error fetching patient profile', { 
        error: error.message, 
        patientId: req.params.patientId,
        requestId: req.headers['x-request-id']
      });
      next(error);
    }
  };

  /**
   * Update patient profile
   */
  public updatePatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;
      const userId = req.headers['x-user-id'] as string;
      const updateData = req.body;

      logger.info('Updating patient profile', { patientId, userId });

      // Validate update data
      const validation = validatePatientData(updateData, true); // partial validation
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update data',
            details: validation.errors
          }
        } as ApiResponse);
        return;
      }

      const updatedPatient = await this.patientService.updatePatient(patientId, updateData, userId);

      if (!updatedPatient) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PATIENT_NOT_FOUND',
            message: 'Patient not found'
          }
        } as ApiResponse);
        return;
      }

      logger.info('Patient profile updated successfully', { 
        patientId, 
        userId,
        requestId: req.headers['x-request-id']
      });

      res.json({
        success: true,
        data: updatedPatient,
        message: 'Patient profile updated successfully'
      } as ApiResponse<Patient>);

    } catch (error) {
      logger.error('Error updating patient profile', { 
        error: error.message, 
        patientId: req.params.patientId,
        requestId: req.headers['x-request-id']
      });
      next(error);
    }
  };

  // ============================================================================
  // PREGNANCY MANAGEMENT
  // ============================================================================

  /**
   * Create a new pregnancy record
   */
  public createPregnancy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;
      const pregnancyData = req.body;
      const userId = req.headers['x-user-id'] as string;

      logger.info('Creating new pregnancy record', { patientId, userId });

      // Validate pregnancy data
      if (!pregnancyData.lastMenstrualPeriod || !pregnancyData.estimatedDueDate) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Last menstrual period and estimated due date are required'
          }
        } as ApiResponse);
        return;
      }

      const pregnancy = await this.pregnancyService.createPregnancy({
        ...pregnancyData,
        patientId,
        status: PregnancyStatus.ACTIVE
      });

      // Initialize risk assessment
      await this.pregnancyService.initializeRiskAssessment(pregnancy.id);

      // Send pregnancy confirmation notification
      await this.notificationService.sendPregnancyConfirmationNotification(patientId, pregnancy.id);

      logger.info('Pregnancy record created successfully', { 
        pregnancyId: pregnancy.id,
        patientId,
        requestId: req.headers['x-request-id']
      });

      res.status(201).json({
        success: true,
        data: pregnancy,
        message: 'Pregnancy record created successfully'
      } as ApiResponse<Pregnancy>);

    } catch (error) {
      logger.error('Error creating pregnancy record', { 
        error: error.message, 
        patientId: req.params.patientId,
        requestId: req.headers['x-request-id']
      });
      next(error);
    }
  };

  /**
   * Get current pregnancy for patient
   */
  public getCurrentPregnancy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;
      const userId = req.headers['x-user-id'] as string;

      logger.debug('Fetching current pregnancy', { patientId, userId });

      const pregnancy = await this.pregnancyService.getCurrentPregnancy(patientId);

      if (!pregnancy) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_ACTIVE_PREGNANCY',
            message: 'No active pregnancy found for this patient'
          }
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: pregnancy
      } as ApiResponse<Pregnancy>);

    } catch (error) {
      logger.error('Error fetching current pregnancy', { 
        error: error.message, 
        patientId: req.params.patientId,
        requestId: req.headers['x-request-id']
      });
      next(error);
    }
  };

  // ============================================================================
  // VITAL SIGNS MANAGEMENT
  // ============================================================================

  /**
   * Record new vital signs
   */
  public recordVitalSigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;
      const vitalSignsData = req.body;
      const userId = req.headers['x-user-id'] as string;

      logger.info('Recording vital signs', { patientId, userId });

      // Get current pregnancy
      const pregnancy = await this.pregnancyService.getCurrentPregnancy(patientId);
      if (!pregnancy) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_ACTIVE_PREGNANCY',
            message: 'No active pregnancy found for vital signs recording'
          }
        } as ApiResponse);
        return;
      }

      // Validate vital signs data
      const validation = validateVitalSigns(vitalSignsData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid vital signs data',
            details: validation.errors
          }
        } as ApiResponse);
        return;
      }

      // Record vital signs
      const vitalSigns = await this.vitalSignsService.recordVitalSigns({
        ...vitalSignsData,
        pregnancyId: pregnancy.id,
        recordedBy: userId,
        source: vitalSignsData.source || DataSource.MANUAL_ENTRY,
        recordedAt: new Date()
      });

      // Trigger risk assessment update
      await this.pregnancyService.updateRiskAssessment(pregnancy.id, vitalSigns);

      // Check for alerts
      await this.checkVitalSignsAlerts(vitalSigns, pregnancy);

      logger.info('Vital signs recorded successfully', { 
        vitalSignsId: vitalSigns.id,
        pregnancyId: pregnancy.id,
        patientId,
        requestId: req.headers['x-request-id']
      });

      res.status(201).json({
        success: true,
        data: vitalSigns,
        message: 'Vital signs recorded successfully'
      } as ApiResponse<VitalSigns>);

    } catch (error) {
      logger.error('Error recording vital signs', { 
        error: error.message, 
        patientId: req.params.patientId,
        requestId: req.headers['x-request-id']
      });
      next(error);
    }
  };

  /**
   * Get vital signs history
   */
  public getVitalSignsHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;
      const { startDate, endDate, limit = 50, offset = 0 } = req.query;

      logger.debug('Fetching vital signs history', { patientId, startDate, endDate });

      const pregnancy = await this.pregnancyService.getCurrentPregnancy(patientId);
      if (!pregnancy) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_ACTIVE_PREGNANCY',
            message: 'No active pregnancy found'
          }
        } as ApiResponse);
        return;
      }

      const vitalSignsHistory = await this.vitalSignsService.getVitalSignsHistory(
        pregnancy.id,
        {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      );

      res.json({
        success: true,
        data: vitalSignsHistory.data,
        pagination: {
          page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
          limit: parseInt(limit as string),
          total: vitalSignsHistory.total,
          totalPages: Math.ceil(vitalSignsHistory.total / parseInt(limit as string)),
          hasNext: (parseInt(offset as string) + parseInt(limit as string)) < vitalSignsHistory.total,
          hasPrev: parseInt(offset as string) > 0
        }
      } as ApiResponse<VitalSigns[]>);

    } catch (error) {
      logger.error('Error fetching vital signs history', { 
        error: error.message, 
        patientId: req.params.patientId,
        requestId: req.headers['x-request-id']
      });
      next(error);
    }
  };

  /**
   * Get latest vital signs
   */
  public getLatestVitalSigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;

      logger.debug('Fetching latest vital signs', { patientId });

      const pregnancy = await this.pregnancyService.getCurrentPregnancy(patientId);
      if (!pregnancy) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_ACTIVE_PREGNANCY',
            message: 'No active pregnancy found'
          }
        } as ApiResponse);
        return;
      }

      const latestVitalSigns = await this.vitalSignsService.getLatestVitalSigns(pregnancy.id);

      res.json({
        success: true,
        data: latestVitalSigns
      } as ApiResponse<VitalSigns | null>);

    } catch (error) {
      logger.error('Error fetching latest vital signs', { 
        error: error.message, 
        patientId: req.params.patientId,
        requestId: req.headers['x-request-id']
      });
      next(error);
    }
  };

  // ============================================================================
  // PATIENT DASHBOARD
  // ============================================================================

  /**
   * Get patient dashboard data
   */
  public getPatientDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;
      const userId = req.headers['x-user-id'] as string;

      logger.debug('Fetching patient dashboard data', { patientId, userId });

      // Get patient profile
      const patient = await this.patientService.getPatientById(patientId);
      if (!patient) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PATIENT_NOT_FOUND',
            message: 'Patient not found'
          }
        } as ApiResponse);
        return;
      }

      // Get current pregnancy
      const pregnancy = await this.pregnancyService.getCurrentPregnancy(patientId);
      
      // Get latest vital signs
      const latestVitalSigns = pregnancy ? 
        await this.vitalSignsService.getLatestVitalSigns(pregnancy.id) : null;

      // Get recent risk assessment
      const riskAssessment = pregnancy ? 
        await this.pregnancyService.getLatestRiskAssessment(pregnancy.id) : null;

      // Get upcoming appointments
      const upcomingAppointments = await this.patientService.getUpcomingAppointments(patientId, 5);

      // Get recent notifications
      const recentNotifications = await this.notificationService.getRecentNotifications(patientId, 10);

      const dashboardData = {
        patient,
        pregnancy,
        latestVitalSigns,
        riskAssessment,
        upcomingAppointments,
        recentNotifications,
        summary: {
          gestationalAge: pregnancy?.gestationalAge || 0,
          currentRiskScore: riskAssessment?.overallRiskScore || 0,
          nextAppointment: upcomingAppointments[0] || null,
          unreadNotifications: recentNotifications.filter(n => !n.readAt).length
        }
      };

      res.json({
        success: true,
        data: dashboardData
      } as ApiResponse);

    } catch (error) {
      logger.error('Error fetching patient dashboard data', { 
        error: error.message, 
        patientId: req.params.patientId,
        requestId: req.headers['x-request-id']
      });
      next(error);
    }
  };

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Check vital signs for alerts and trigger notifications
   */
  private async checkVitalSignsAlerts(vitalSigns: VitalSigns, pregnancy: Pregnancy): Promise<void> => {
    try {
      const alerts = [];

      // Blood pressure alerts
      if (vitalSigns.bloodPressure) {
        const { systolic, diastolic } = vitalSigns.bloodPressure;
        
        if (systolic >= 140 || diastolic >= 90) {
          alerts.push({
            type: 'HIGH_BLOOD_PRESSURE',
            severity: systolic >= 160 || diastolic >= 110 ? 'urgent' : 'high',
            message: `Blood pressure reading: ${systolic}/${diastolic} mmHg`
          });
        }
      }

      // Heart rate alerts
      if (vitalSigns.heartRate) {
        if (vitalSigns.heartRate > 100 || vitalSigns.heartRate < 60) {
          alerts.push({
            type: 'ABNORMAL_HEART_RATE',
            severity: 'medium',
            message: `Heart rate: ${vitalSigns.heartRate} bpm`
          });
        }
      }

      // Fetal heart rate alerts
      if (vitalSigns.fetalHeartRate) {
        if (vitalSigns.fetalHeartRate < 110 || vitalSigns.fetalHeartRate > 160) {
          alerts.push({
            type: 'ABNORMAL_FETAL_HEART_RATE',
            severity: 'urgent',
            message: `Fetal heart rate: ${vitalSigns.fetalHeartRate} bpm`
          });
        }
      }

      // Glucose alerts
      if (vitalSigns.glucoseLevel) {
        if (vitalSigns.glucoseLevel > 140) {
          alerts.push({
            type: 'HIGH_GLUCOSE',
            severity: 'high',
            message: `Glucose level: ${vitalSigns.glucoseLevel} mg/dL`
          });
        }
      }

      // Send alerts if any
      for (const alert of alerts) {
        await this.notificationService.sendVitalSignsAlert(
          pregnancy.patientId,
          pregnancy.providerId,
          alert,
          vitalSigns
        );
      }

    } catch (error) {
      logger.error('Error checking vital signs alerts', { 
        error: error.message,
        vitalSignsId: vitalSigns.id
      });
    }
  }
}