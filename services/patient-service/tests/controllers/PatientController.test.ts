/**
 * PregnancyCare 360 - Patient Controller Unit Tests
 * 
 * Comprehensive test suite for PatientController with >90% coverage target
 */

import { Request, Response, NextFunction } from 'express';
import { PatientController } from '../../src/controllers/PatientController';
import { PatientService } from '../../src/services/PatientService';
import { VitalSignsService } from '../../src/services/VitalSignsService';
import { PregnancyService } from '../../src/services/PregnancyService';
import { NotificationService } from '../../src/services/NotificationService';
import { 
  Patient, 
  VitalSigns, 
  Pregnancy, 
  PregnancyStatus,
  DataSource 
} from '../../../../packages/shared/src/types';

// Mock services
jest.mock('../../src/services/PatientService');
jest.mock('../../src/services/VitalSignsService');
jest.mock('../../src/services/PregnancyService');
jest.mock('../../src/services/NotificationService');
jest.mock('../../src/validators/PatientValidator');

const MockedPatientService = PatientService as jest.MockedClass<typeof PatientService>;
const MockedVitalSignsService = VitalSignsService as jest.MockedClass<typeof VitalSignsService>;
const MockedPregnancyService = PregnancyService as jest.MockedClass<typeof PregnancyService>;
const MockedNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>;

describe('PatientController', () => {
  let patientController: PatientController;
  let mockPatientService: jest.Mocked<PatientService>;
  let mockVitalSignsService: jest.Mocked<VitalSignsService>;
  let mockPregnancyService: jest.Mocked<PregnancyService>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create controller instance
    patientController = new PatientController();

    // Setup service mocks
    mockPatientService = new MockedPatientService() as jest.Mocked<PatientService>;
    mockVitalSignsService = new MockedVitalSignsService() as jest.Mocked<VitalSignsService>;
    mockPregnancyService = new MockedPregnancyService() as jest.Mocked<PregnancyService>;
    mockNotificationService = new MockedNotificationService() as jest.Mocked<NotificationService>;

    // Setup request/response mocks
    mockRequest = {
      headers: {
        'x-user-id': 'test-user-id',
        'x-request-id': 'test-request-id',
        'x-user-role': 'patient'
      },
      params: {},
      body: {},
      query: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Inject mocked services
    (patientController as any).patientService = mockPatientService;
    (patientController as any).vitalSignsService = mockVitalSignsService;
    (patientController as any).pregnancyService = mockPregnancyService;
    (patientController as any).notificationService = mockNotificationService;
  });

  // ============================================================================
  // PATIENT PROFILE MANAGEMENT TESTS
  // ============================================================================

  describe('createPatient', () => {
    const validPatientData = {
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      email: 'jane.doe@example.com',
      phone: '+1234567890',
      emergencyContact: {
        name: 'John Doe',
        relationship: 'spouse',
        phone: '+1234567891'
      }
    };

    beforeEach(() => {
      mockRequest.body = validPatientData;
      
      // Mock validator
      const { validatePatientData } = require('../../src/validators/PatientValidator');
      validatePatientData.mockReturnValue({ isValid: true, errors: [] });
    });

    it('should create patient successfully with valid data', async () => {
      // Arrange
      const expectedPatient: Patient = {
        id: 'patient-123',
        userId: 'test-user-id',
        ...validPatientData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Patient;

      mockPatientService.createPatient.mockResolvedValue(expectedPatient);
      mockNotificationService.sendWelcomeNotification.mockResolvedValue(undefined);

      // Act
      await patientController.createPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockPatientService.createPatient).toHaveBeenCalledWith({
        ...validPatientData,
        userId: 'test-user-id'
      });
      expect(mockNotificationService.sendWelcomeNotification).toHaveBeenCalledWith('patient-123');
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expectedPatient,
        message: 'Patient profile created successfully'
      });
    });

    it('should return validation error for invalid data', async () => {
      // Arrange
      const { validatePatientData } = require('../../src/validators/PatientValidator');
      validatePatientData.mockReturnValue({
        isValid: false,
        errors: ['Email is required', 'Date of birth is invalid']
      });

      // Act
      await patientController.createPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid patient data',
          details: ['Email is required', 'Date of birth is invalid']
        }
      });
      expect(mockPatientService.createPatient).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const serviceError = new Error('Database connection failed');
      mockPatientService.createPatient.mockRejectedValue(serviceError);

      // Act
      await patientController.createPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('getPatient', () => {
    const patientId = 'patient-123';
    const expectedPatient: Patient = {
      id: patientId,
      userId: 'test-user-id',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    } as Patient;

    beforeEach(() => {
      mockRequest.params = { patientId };
    });

    it('should return patient data for valid request', async () => {
      // Arrange
      mockPatientService.getPatientById.mockResolvedValue(expectedPatient);

      // Act
      await patientController.getPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockPatientService.getPatientById).toHaveBeenCalledWith(patientId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expectedPatient
      });
    });

    it('should return 404 for non-existent patient', async () => {
      // Arrange
      mockPatientService.getPatientById.mockResolvedValue(null);

      // Act
      await patientController.getPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PATIENT_NOT_FOUND',
          message: 'Patient not found'
        }
      });
    });

    it('should deny access for unauthorized user', async () => {
      // Arrange
      const unauthorizedPatient = { ...expectedPatient, userId: 'different-user-id' };
      mockPatientService.getPatientById.mockResolvedValue(unauthorizedPatient);

      // Act
      await patientController.getPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to patient data'
        }
      });
    });

    it('should allow provider access to patient data', async () => {
      // Arrange
      const unauthorizedPatient = { ...expectedPatient, userId: 'different-user-id' };
      mockPatientService.getPatientById.mockResolvedValue(unauthorizedPatient);
      mockRequest.headers!['x-user-role'] = 'provider';

      // Act
      await patientController.getPatient(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: unauthorizedPatient
      });
    });
  });

  // ============================================================================
  // PREGNANCY MANAGEMENT TESTS
  // ============================================================================

  describe('createPregnancy', () => {
    const patientId = 'patient-123';
    const validPregnancyData = {
      lastMenstrualPeriod: '2024-01-01',
      estimatedDueDate: '2024-10-08',
      providerId: 'provider-123'
    };

    beforeEach(() => {
      mockRequest.params = { patientId };
      mockRequest.body = validPregnancyData;
    });

    it('should create pregnancy successfully', async () => {
      // Arrange
      const expectedPregnancy: Pregnancy = {
        id: 'pregnancy-123',
        patientId,
        providerId: 'provider-123',
        status: PregnancyStatus.ACTIVE,
        lastMenstrualPeriod: new Date('2024-01-01'),
        estimatedDueDate: new Date('2024-10-08'),
        gestationalAge: 20,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Pregnancy;

      mockPregnancyService.createPregnancy.mockResolvedValue(expectedPregnancy);
      mockPregnancyService.initializeRiskAssessment.mockResolvedValue(undefined);
      mockNotificationService.sendPregnancyConfirmationNotification.mockResolvedValue(undefined);

      // Act
      await patientController.createPregnancy(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockPregnancyService.createPregnancy).toHaveBeenCalledWith({
        ...validPregnancyData,
        patientId,
        status: PregnancyStatus.ACTIVE
      });
      expect(mockPregnancyService.initializeRiskAssessment).toHaveBeenCalledWith('pregnancy-123');
      expect(mockNotificationService.sendPregnancyConfirmationNotification).toHaveBeenCalledWith(patientId, 'pregnancy-123');
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should validate required pregnancy data', async () => {
      // Arrange
      mockRequest.body = { providerId: 'provider-123' }; // Missing required fields

      // Act
      await patientController.createPregnancy(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Last menstrual period and estimated due date are required'
        }
      });
    });
  });

  // ============================================================================
  // VITAL SIGNS MANAGEMENT TESTS
  // ============================================================================

  describe('recordVitalSigns', () => {
    const patientId = 'patient-123';
    const pregnancyId = 'pregnancy-123';
    const validVitalSignsData = {
      bloodPressure: { systolic: 120, diastolic: 80 },
      heartRate: 72,
      weight: 65.5,
      temperature: 36.8,
      glucoseLevel: 95
    };

    beforeEach(() => {
      mockRequest.params = { patientId };
      mockRequest.body = validVitalSignsData;

      const mockPregnancy: Pregnancy = {
        id: pregnancyId,
        patientId,
        status: PregnancyStatus.ACTIVE
      } as Pregnancy;

      mockPregnancyService.getCurrentPregnancy.mockResolvedValue(mockPregnancy);

      // Mock validator
      const { validateVitalSigns } = require('../../src/validators/PatientValidator');
      validateVitalSigns.mockReturnValue({ isValid: true, errors: [] });
    });

    it('should record vital signs successfully', async () => {
      // Arrange
      const expectedVitalSigns: VitalSigns = {
        id: 'vitals-123',
        pregnancyId,
        recordedBy: 'test-user-id',
        source: DataSource.MANUAL_ENTRY,
        recordedAt: new Date(),
        ...validVitalSignsData
      } as VitalSigns;

      mockVitalSignsService.recordVitalSigns.mockResolvedValue(expectedVitalSigns);
      mockPregnancyService.updateRiskAssessment.mockResolvedValue(undefined);

      // Act
      await patientController.recordVitalSigns(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockVitalSignsService.recordVitalSigns).toHaveBeenCalledWith({
        ...validVitalSignsData,
        pregnancyId,
        recordedBy: 'test-user-id',
        source: DataSource.MANUAL_ENTRY,
        recordedAt: expect.any(Date)
      });
      expect(mockPregnancyService.updateRiskAssessment).toHaveBeenCalledWith(pregnancyId, expectedVitalSigns);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should handle no active pregnancy', async () => {
      // Arrange
      mockPregnancyService.getCurrentPregnancy.mockResolvedValue(null);

      // Act
      await patientController.recordVitalSigns(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_ACTIVE_PREGNANCY',
          message: 'No active pregnancy found for vital signs recording'
        }
      });
    });

    it('should validate vital signs data', async () => {
      // Arrange
      const { validateVitalSigns } = require('../../src/validators/PatientValidator');
      validateVitalSigns.mockReturnValue({
        isValid: false,
        errors: ['Blood pressure values are invalid']
      });

      // Act
      await patientController.recordVitalSigns(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid vital signs data',
          details: ['Blood pressure values are invalid']
        }
      });
    });
  });

  describe('getVitalSignsHistory', () => {
    const patientId = 'patient-123';
    const pregnancyId = 'pregnancy-123';

    beforeEach(() => {
      mockRequest.params = { patientId };
      mockRequest.query = { limit: '10', offset: '0' };

      const mockPregnancy: Pregnancy = {
        id: pregnancyId,
        patientId,
        status: PregnancyStatus.ACTIVE
      } as Pregnancy;

      mockPregnancyService.getCurrentPregnancy.mockResolvedValue(mockPregnancy);
    });

    it('should return vital signs history with pagination', async () => {
      // Arrange
      const mockVitalSignsHistory = {
        data: [
          { id: 'vitals-1', pregnancyId, recordedAt: new Date() },
          { id: 'vitals-2', pregnancyId, recordedAt: new Date() }
        ] as VitalSigns[],
        total: 25
      };

      mockVitalSignsService.getVitalSignsHistory.mockResolvedValue(mockVitalSignsHistory);

      // Act
      await patientController.getVitalSignsHistory(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockVitalSignsService.getVitalSignsHistory).toHaveBeenCalledWith(
        pregnancyId,
        {
          startDate: undefined,
          endDate: undefined,
          limit: 10,
          offset: 0
        }
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockVitalSignsHistory.data,
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 3,
          hasNext: true,
          hasPrev: false
        }
      });
    });

    it('should handle date range filtering', async () => {
      // Arrange
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        limit: '20',
        offset: '10'
      };

      const mockVitalSignsHistory = {
        data: [],
        total: 0
      };

      mockVitalSignsService.getVitalSignsHistory.mockResolvedValue(mockVitalSignsHistory);

      // Act
      await patientController.getVitalSignsHistory(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockVitalSignsService.getVitalSignsHistory).toHaveBeenCalledWith(
        pregnancyId,
        {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          limit: 20,
          offset: 10
        }
      );
    });
  });

  // ============================================================================
  // DASHBOARD TESTS
  // ============================================================================

  describe('getPatientDashboard', () => {
    const patientId = 'patient-123';

    beforeEach(() => {
      mockRequest.params = { patientId };
    });

    it('should return comprehensive dashboard data', async () => {
      // Arrange
      const mockPatient: Patient = {
        id: patientId,
        userId: 'test-user-id',
        firstName: 'Jane',
        lastName: 'Doe'
      } as Patient;

      const mockPregnancy: Pregnancy = {
        id: 'pregnancy-123',
        patientId,
        gestationalAge: 20
      } as Pregnancy;

      const mockVitalSigns: VitalSigns = {
        id: 'vitals-123',
        pregnancyId: 'pregnancy-123',
        recordedAt: new Date()
      } as VitalSigns;

      const mockRiskAssessment = {
        id: 'risk-123',
        overallRiskScore: 25
      };

      const mockAppointments = [
        { id: 'appt-123', scheduledAt: new Date() }
      ];

      const mockNotifications = [
        { id: 'notif-123', readAt: null }
      ];

      mockPatientService.getPatientById.mockResolvedValue(mockPatient);
      mockPregnancyService.getCurrentPregnancy.mockResolvedValue(mockPregnancy);
      mockVitalSignsService.getLatestVitalSigns.mockResolvedValue(mockVitalSigns);
      mockPregnancyService.getLatestRiskAssessment.mockResolvedValue(mockRiskAssessment);
      mockPatientService.getUpcomingAppointments.mockResolvedValue(mockAppointments);
      mockNotificationService.getRecentNotifications.mockResolvedValue(mockNotifications);

      // Act
      await patientController.getPatientDashboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          patient: mockPatient,
          pregnancy: mockPregnancy,
          latestVitalSigns: mockVitalSigns,
          riskAssessment: mockRiskAssessment,
          upcomingAppointments: mockAppointments,
          recentNotifications: mockNotifications,
          summary: {
            gestationalAge: 20,
            currentRiskScore: 25,
            nextAppointment: mockAppointments[0],
            unreadNotifications: 1
          }
        }
      });
    });

    it('should handle patient not found', async () => {
      // Arrange
      mockPatientService.getPatientById.mockResolvedValue(null);

      // Act
      await patientController.getPatientDashboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PATIENT_NOT_FOUND',
          message: 'Patient not found'
        }
      });
    });
  });

  // ============================================================================
  // ALERT SYSTEM TESTS
  // ============================================================================

  describe('checkVitalSignsAlerts', () => {
    it('should trigger high blood pressure alert', async () => {
      // Arrange
      const highBPVitalSigns: VitalSigns = {
        id: 'vitals-123',
        pregnancyId: 'pregnancy-123',
        bloodPressure: { systolic: 150, diastolic: 95 },
        recordedAt: new Date()
      } as VitalSigns;

      const mockPregnancy: Pregnancy = {
        id: 'pregnancy-123',
        patientId: 'patient-123',
        providerId: 'provider-123'
      } as Pregnancy;

      mockNotificationService.sendVitalSignsAlert.mockResolvedValue(undefined);

      // Act
      await (patientController as any).checkVitalSignsAlerts(highBPVitalSigns, mockPregnancy);

      // Assert
      expect(mockNotificationService.sendVitalSignsAlert).toHaveBeenCalledWith(
        'patient-123',
        'provider-123',
        expect.objectContaining({
          type: 'HIGH_BLOOD_PRESSURE',
          severity: 'high',
          message: 'Blood pressure reading: 150/95 mmHg'
        }),
        highBPVitalSigns
      );
    });

    it('should trigger urgent fetal heart rate alert', async () => {
      // Arrange
      const abnormalFHRVitalSigns: VitalSigns = {
        id: 'vitals-123',
        pregnancyId: 'pregnancy-123',
        fetalHeartRate: 100, // Below normal range
        recordedAt: new Date()
      } as VitalSigns;

      const mockPregnancy: Pregnancy = {
        id: 'pregnancy-123',
        patientId: 'patient-123',
        providerId: 'provider-123'
      } as Pregnancy;

      mockNotificationService.sendVitalSignsAlert.mockResolvedValue(undefined);

      // Act
      await (patientController as any).checkVitalSignsAlerts(abnormalFHRVitalSigns, mockPregnancy);

      // Assert
      expect(mockNotificationService.sendVitalSignsAlert).toHaveBeenCalledWith(
        'patient-123',
        'provider-123',
        expect.objectContaining({
          type: 'ABNORMAL_FETAL_HEART_RATE',
          severity: 'urgent',
          message: 'Fetal heart rate: 100 bpm'
        }),
        abnormalFHRVitalSigns
      );
    });

    it('should not trigger alerts for normal values', async () => {
      // Arrange
      const normalVitalSigns: VitalSigns = {
        id: 'vitals-123',
        pregnancyId: 'pregnancy-123',
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        fetalHeartRate: 140,
        glucoseLevel: 95,
        recordedAt: new Date()
      } as VitalSigns;

      const mockPregnancy: Pregnancy = {
        id: 'pregnancy-123',
        patientId: 'patient-123',
        providerId: 'provider-123'
      } as Pregnancy;

      // Act
      await (patientController as any).checkVitalSignsAlerts(normalVitalSigns, mockPregnancy);

      // Assert
      expect(mockNotificationService.sendVitalSignsAlert).not.toHaveBeenCalled();
    });
  });
});