"""
PregnancyCare 360 - AI/ML Service

Core AI/ML service for risk assessment, predictive analytics, and clinical decision support.
Provides real-time risk scoring with 14-day early detection capability.
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import asyncio
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import joblib
import redis
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uvicorn

from models.risk_assessment_model import RiskAssessmentModel
from models.preeclampsia_model import PreeclampsiaModel
from models.gestational_diabetes_model import GestationalDiabetesModel
from models.preterm_birth_model import PretermBirthModel
from services.data_processor import DataProcessor
from services.feature_engineer import FeatureEngineer
from services.model_manager import ModelManager
from utils.logger import setup_logger
from utils.metrics import MetricsCollector
from schemas.risk_assessment import RiskAssessmentRequest, RiskAssessmentResponse
from schemas.prediction import PredictionRequest, PredictionResponse
from database.models import RiskAssessment, Prediction

# Initialize FastAPI app
app = FastAPI(
    title="PregnancyCare 360 AI/ML Service",
    description="AI-powered risk assessment and predictive analytics for pregnancy monitoring",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Setup logging
logger = setup_logger("ai-ml-service")

# Security
security = HTTPBearer()

# Initialize services
data_processor = DataProcessor()
feature_engineer = FeatureEngineer()
model_manager = ModelManager()
metrics_collector = MetricsCollector()

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pc360_user:pc360_dev_password@localhost:5432/analytics_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Redis connection
redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

# ============================================================================
# MIDDLEWARE CONFIGURATION
# ============================================================================

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Configure appropriately for production
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = datetime.utcnow()
    
    # Log request
    logger.info(f"Request: {request.method} {request.url}")
    
    response = await call_next(request)
    
    # Log response
    process_time = (datetime.utcnow() - start_time).total_seconds()
    logger.info(f"Response: {response.status_code} - {process_time:.3f}s")
    
    return response

# ============================================================================
# AUTHENTICATION & AUTHORIZATION
# ============================================================================

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and extract user information"""
    try:
        # In production, verify JWT token properly
        # For now, we'll extract user info from headers
        return {
            "user_id": "user_123",  # Extract from token
            "role": "provider"      # Extract from token
        }
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class VitalSignsData(BaseModel):
    """Vital signs data for risk assessment"""
    blood_pressure_systolic: Optional[float] = None
    blood_pressure_diastolic: Optional[float] = None
    heart_rate: Optional[float] = None
    weight: Optional[float] = None
    temperature: Optional[float] = None
    glucose_level: Optional[float] = None
    fetal_heart_rate: Optional[float] = None
    oxygen_saturation: Optional[float] = None

class PatientData(BaseModel):
    """Patient demographic and medical history data"""
    age: int
    bmi: float
    gestational_age: float
    previous_pregnancies: int = 0
    previous_complications: List[str] = []
    chronic_conditions: List[str] = []
    medications: List[str] = []
    family_history: List[str] = []

class RiskAssessmentInput(BaseModel):
    """Input data for risk assessment"""
    patient_id: str
    pregnancy_id: str
    patient_data: PatientData
    vital_signs: VitalSignsData
    lab_results: Optional[Dict[str, float]] = None
    symptoms: Optional[List[str]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class RiskScore(BaseModel):
    """Individual risk score for a specific condition"""
    condition: str
    score: float = Field(..., ge=0, le=100)
    probability: float = Field(..., ge=0, le=1)
    confidence: float = Field(..., ge=0, le=1)
    trend: str = Field(..., regex="^(improving|stable|worsening)$")
    contributing_factors: List[str]
    early_warning_signals: List[str]

class RiskAssessmentOutput(BaseModel):
    """Risk assessment output"""
    assessment_id: str
    patient_id: str
    pregnancy_id: str
    timestamp: datetime
    overall_risk_score: float = Field(..., ge=0, le=100)
    risk_level: str = Field(..., regex="^(low|moderate|high|critical)$")
    risk_scores: List[RiskScore]
    recommendations: List[Dict[str, Any]]
    next_assessment_due: datetime
    model_version: str
    confidence: float = Field(..., ge=0, le=1)

# ============================================================================
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        db_status = "healthy"
        try:
            with engine.connect() as conn:
                conn.execute("SELECT 1")
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"
        
        # Check Redis connection
        redis_status = "healthy"
        try:
            redis_client.ping()
        except Exception as e:
            redis_status = f"unhealthy: {str(e)}"
        
        # Check model status
        model_status = model_manager.get_model_status()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0",
            "services": {
                "database": db_status,
                "redis": redis_status,
                "models": model_status
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@app.get("/models/status")
async def get_model_status(user: dict = Depends(verify_token)):
    """Get status of all AI/ML models"""
    try:
        status = model_manager.get_detailed_model_status()
        return {
            "success": True,
            "data": status,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting model status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get model status")

# ============================================================================
# RISK ASSESSMENT ENDPOINTS
# ============================================================================

@app.post("/risk-assessment", response_model=RiskAssessmentOutput)
async def perform_risk_assessment(
    assessment_input: RiskAssessmentInput,
    background_tasks: BackgroundTasks,
    user: dict = Depends(verify_token)
):
    """Perform comprehensive risk assessment for a pregnancy"""
    try:
        logger.info(f"Starting risk assessment for patient {assessment_input.patient_id}")
        
        # Validate input data
        if not assessment_input.patient_data or not assessment_input.vital_signs:
            raise HTTPException(status_code=400, detail="Patient data and vital signs are required")
        
        # Process and engineer features
        features = await feature_engineer.engineer_features(assessment_input)
        
        # Get risk scores for each condition
        risk_scores = []
        
        # Preeclampsia risk
        preeclampsia_model = model_manager.get_model("preeclampsia")
        preeclampsia_score = await preeclampsia_model.predict(features)
        risk_scores.append(RiskScore(
            condition="preeclampsia",
            score=preeclampsia_score["score"],
            probability=preeclampsia_score["probability"],
            confidence=preeclampsia_score["confidence"],
            trend=preeclampsia_score["trend"],
            contributing_factors=preeclampsia_score["contributing_factors"],
            early_warning_signals=preeclampsia_score["early_warning_signals"]
        ))
        
        # Gestational diabetes risk
        gd_model = model_manager.get_model("gestational_diabetes")
        gd_score = await gd_model.predict(features)
        risk_scores.append(RiskScore(
            condition="gestational_diabetes",
            score=gd_score["score"],
            probability=gd_score["probability"],
            confidence=gd_score["confidence"],
            trend=gd_score["trend"],
            contributing_factors=gd_score["contributing_factors"],
            early_warning_signals=gd_score["early_warning_signals"]
        ))
        
        # Preterm birth risk
        preterm_model = model_manager.get_model("preterm_birth")
        preterm_score = await preterm_model.predict(features)
        risk_scores.append(RiskScore(
            condition="preterm_birth",
            score=preterm_score["score"],
            probability=preterm_score["probability"],
            confidence=preterm_score["confidence"],
            trend=preterm_score["trend"],
            contributing_factors=preterm_score["contributing_factors"],
            early_warning_signals=preterm_score["early_warning_signals"]
        ))
        
        # Calculate overall risk score (weighted average)
        weights = {"preeclampsia": 0.4, "gestational_diabetes": 0.3, "preterm_birth": 0.3}
        overall_score = sum(score.score * weights[score.condition] for score in risk_scores)
        
        # Determine risk level
        if overall_score >= 80:
            risk_level = "critical"
        elif overall_score >= 60:
            risk_level = "high"
        elif overall_score >= 30:
            risk_level = "moderate"
        else:
            risk_level = "low"
        
        # Generate recommendations
        recommendations = await generate_recommendations(risk_scores, assessment_input)
        
        # Calculate next assessment due date
        if risk_level == "critical":
            next_assessment = datetime.utcnow() + timedelta(hours=6)
        elif risk_level == "high":
            next_assessment = datetime.utcnow() + timedelta(days=1)
        elif risk_level == "moderate":
            next_assessment = datetime.utcnow() + timedelta(days=3)
        else:
            next_assessment = datetime.utcnow() + timedelta(days=7)
        
        # Create assessment result
        assessment_result = RiskAssessmentOutput(
            assessment_id=f"ra_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{assessment_input.patient_id}",
            patient_id=assessment_input.patient_id,
            pregnancy_id=assessment_input.pregnancy_id,
            timestamp=datetime.utcnow(),
            overall_risk_score=overall_score,
            risk_level=risk_level,
            risk_scores=risk_scores,
            recommendations=recommendations,
            next_assessment_due=next_assessment,
            model_version=model_manager.get_model_version(),
            confidence=np.mean([score.confidence for score in risk_scores])
        )
        
        # Store assessment in database (background task)
        background_tasks.add_task(store_risk_assessment, assessment_result)
        
        # Cache result for quick retrieval
        background_tasks.add_task(cache_assessment_result, assessment_result)
        
        # Collect metrics
        metrics_collector.record_assessment(assessment_result)
        
        logger.info(f"Risk assessment completed for patient {assessment_input.patient_id}")
        
        return assessment_result
        
    except Exception as e:
        logger.error(f"Error performing risk assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Risk assessment failed: {str(e)}")

@app.get("/risk-assessment/{assessment_id}")
async def get_risk_assessment(
    assessment_id: str,
    user: dict = Depends(verify_token)
):
    """Get a specific risk assessment by ID"""
    try:
        # Try cache first
        cached_result = redis_client.get(f"assessment:{assessment_id}")
        if cached_result:
            return json.loads(cached_result)
        
        # Query database
        db = SessionLocal()
        try:
            assessment = db.query(RiskAssessment).filter(
                RiskAssessment.assessment_id == assessment_id
            ).first()
            
            if not assessment:
                raise HTTPException(status_code=404, detail="Risk assessment not found")
            
            return assessment.to_dict()
        finally:
            db.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving risk assessment: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve risk assessment")

@app.get("/risk-assessment/patient/{patient_id}")
async def get_patient_risk_history(
    patient_id: str,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(verify_token)
):
    """Get risk assessment history for a patient"""
    try:
        db = SessionLocal()
        try:
            assessments = db.query(RiskAssessment).filter(
                RiskAssessment.patient_id == patient_id
            ).order_by(RiskAssessment.timestamp.desc()).offset(offset).limit(limit).all()
            
            total = db.query(RiskAssessment).filter(
                RiskAssessment.patient_id == patient_id
            ).count()
            
            return {
                "success": True,
                "data": [assessment.to_dict() for assessment in assessments],
                "pagination": {
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "has_more": (offset + limit) < total
                }
            }
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error retrieving patient risk history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve risk history")

# ============================================================================
# PREDICTION ENDPOINTS
# ============================================================================

@app.post("/predict/early-detection")
async def predict_early_detection(
    prediction_input: RiskAssessmentInput,
    user: dict = Depends(verify_token)
):
    """Predict potential complications with 14-day early detection"""
    try:
        logger.info(f"Starting early detection prediction for patient {prediction_input.patient_id}")
        
        # Engineer features for prediction
        features = await feature_engineer.engineer_features(prediction_input)
        
        # Get early detection model
        early_detection_model = model_manager.get_model("early_detection")
        
        # Make predictions for next 14 days
        predictions = []
        for days_ahead in range(1, 15):
            prediction = await early_detection_model.predict_timeframe(features, days_ahead)
            predictions.append({
                "days_ahead": days_ahead,
                "date": (datetime.utcnow() + timedelta(days=days_ahead)).isoformat(),
                "conditions": prediction["conditions"],
                "overall_probability": prediction["overall_probability"],
                "confidence": prediction["confidence"]
            })
        
        return {
            "success": True,
            "data": {
                "patient_id": prediction_input.patient_id,
                "pregnancy_id": prediction_input.pregnancy_id,
                "prediction_timestamp": datetime.utcnow().isoformat(),
                "predictions": predictions,
                "model_version": model_manager.get_model_version(),
                "detection_window": "14 days"
            }
        }
        
    except Exception as e:
        logger.error(f"Error in early detection prediction: {e}")
        raise HTTPException(status_code=500, detail=f"Early detection prediction failed: {str(e)}")

@app.post("/predict/outcome")
async def predict_pregnancy_outcome(
    prediction_input: RiskAssessmentInput,
    user: dict = Depends(verify_token)
):
    """Predict pregnancy outcomes and delivery complications"""
    try:
        logger.info(f"Starting outcome prediction for patient {prediction_input.patient_id}")
        
        # Engineer features
        features = await feature_engineer.engineer_features(prediction_input)
        
        # Get outcome prediction model
        outcome_model = model_manager.get_model("outcome_prediction")
        
        # Make predictions
        outcome_prediction = await outcome_model.predict(features)
        
        return {
            "success": True,
            "data": {
                "patient_id": prediction_input.patient_id,
                "pregnancy_id": prediction_input.pregnancy_id,
                "prediction_timestamp": datetime.utcnow().isoformat(),
                "delivery_predictions": outcome_prediction["delivery"],
                "maternal_outcomes": outcome_prediction["maternal"],
                "fetal_outcomes": outcome_prediction["fetal"],
                "recommended_interventions": outcome_prediction["interventions"],
                "confidence": outcome_prediction["confidence"],
                "model_version": model_manager.get_model_version()
            }
        }
        
    except Exception as e:
        logger.error(f"Error in outcome prediction: {e}")
        raise HTTPException(status_code=500, detail=f"Outcome prediction failed: {str(e)}")

# ============================================================================
# MODEL MANAGEMENT ENDPOINTS
# ============================================================================

@app.post("/models/retrain")
async def retrain_models(
    background_tasks: BackgroundTasks,
    user: dict = Depends(verify_token)
):
    """Trigger model retraining with latest data"""
    try:
        # Check user permissions (admin only)
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Start retraining in background
        background_tasks.add_task(model_manager.retrain_all_models)
        
        return {
            "success": True,
            "message": "Model retraining initiated",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating model retraining: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate model retraining")

@app.get("/models/performance")
async def get_model_performance(user: dict = Depends(verify_token)):
    """Get performance metrics for all models"""
    try:
        performance_metrics = model_manager.get_performance_metrics()
        
        return {
            "success": True,
            "data": performance_metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error retrieving model performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve model performance")

# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@app.get("/analytics/population-insights")
async def get_population_insights(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(verify_token)
):
    """Get population-level health insights and trends"""
    try:
        # Parse dates
        start = datetime.fromisoformat(start_date) if start_date else datetime.utcnow() - timedelta(days=30)
        end = datetime.fromisoformat(end_date) if end_date else datetime.utcnow()
        
        # Get analytics
        analytics = await data_processor.get_population_insights(start, end)
        
        return {
            "success": True,
            "data": analytics,
            "period": {
                "start_date": start.isoformat(),
                "end_date": end.isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Error retrieving population insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve population insights")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def generate_recommendations(risk_scores: List[RiskScore], assessment_input: RiskAssessmentInput) -> List[Dict[str, Any]]:
    """Generate personalized recommendations based on risk scores"""
    recommendations = []
    
    for risk_score in risk_scores:
        if risk_score.score >= 60:  # High risk
            if risk_score.condition == "preeclampsia":
                recommendations.extend([
                    {
                        "type": "monitoring",
                        "priority": "high",
                        "title": "Increased Blood Pressure Monitoring",
                        "description": "Monitor blood pressure twice daily and report readings above 140/90",
                        "evidence_level": "A"
                    },
                    {
                        "type": "lifestyle",
                        "priority": "medium",
                        "title": "Reduce Sodium Intake",
                        "description": "Limit sodium intake to less than 2300mg per day",
                        "evidence_level": "B"
                    }
                ])
            elif risk_score.condition == "gestational_diabetes":
                recommendations.extend([
                    {
                        "type": "testing",
                        "priority": "high",
                        "title": "Glucose Tolerance Test",
                        "description": "Schedule glucose tolerance test within 1 week",
                        "evidence_level": "A"
                    },
                    {
                        "type": "lifestyle",
                        "priority": "high",
                        "title": "Dietary Modifications",
                        "description": "Consult with nutritionist for diabetic diet plan",
                        "evidence_level": "A"
                    }
                ])
    
    return recommendations

async def store_risk_assessment(assessment: RiskAssessmentOutput):
    """Store risk assessment in database"""
    try:
        db = SessionLocal()
        try:
            db_assessment = RiskAssessment(
                assessment_id=assessment.assessment_id,
                patient_id=assessment.patient_id,
                pregnancy_id=assessment.pregnancy_id,
                timestamp=assessment.timestamp,
                overall_risk_score=assessment.overall_risk_score,
                risk_level=assessment.risk_level,
                risk_scores=json.dumps([score.dict() for score in assessment.risk_scores]),
                recommendations=json.dumps(assessment.recommendations),
                model_version=assessment.model_version,
                confidence=assessment.confidence
            )
            db.add(db_assessment)
            db.commit()
            logger.info(f"Risk assessment stored: {assessment.assessment_id}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error storing risk assessment: {e}")

async def cache_assessment_result(assessment: RiskAssessmentOutput):
    """Cache assessment result in Redis"""
    try:
        redis_client.setex(
            f"assessment:{assessment.assessment_id}",
            3600,  # 1 hour TTL
            json.dumps(assessment.dict(), default=str)
        )
        logger.debug(f"Assessment cached: {assessment.assessment_id}")
    except Exception as e:
        logger.error(f"Error caching assessment: {e}")

# ============================================================================
# APPLICATION STARTUP
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting AI/ML Service...")
    
    # Initialize model manager
    await model_manager.initialize()
    
    # Load pre-trained models
    await model_manager.load_models()
    
    # Initialize metrics collector
    metrics_collector.initialize()
    
    logger.info("AI/ML Service started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down AI/ML Service...")
    
    # Close database connections
    engine.dispose()
    
    # Close Redis connection
    redis_client.close()
    
    logger.info("AI/ML Service shutdown complete")

# ============================================================================
# MAIN APPLICATION
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )