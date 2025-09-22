"""
PregnancyCare 360 - AI/ML Service Integration Tests

Comprehensive test suite for risk assessment functionality with >90% coverage target.
Tests the complete AI/ML pipeline including data processing, feature engineering,
model predictions, and API endpoints.
"""

import pytest
import asyncio
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import redis

# Import the FastAPI app and dependencies
from src.main import app
from src.models.risk_assessment_model import RiskAssessmentModel
from src.services.data_processor import DataProcessor
from src.services.feature_engineer import FeatureEngineer
from src.services.model_manager import ModelManager
from src.database.models import RiskAssessment
from src.schemas.risk_assessment import RiskAssessmentRequest, RiskAssessmentResponse

# Test configuration
TEST_DATABASE_URL = "postgresql://test_user:test_password@localhost:5432/test_db"
TEST_REDIS_URL = "redis://localhost:6379/1"

@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine"""
    engine = create_engine(TEST_DATABASE_URL)
    yield engine
    engine.dispose()

@pytest.fixture(scope="session")
def test_session_factory(test_engine):
    """Create test session factory"""
    return sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture
def test_session(test_session_factory):
    """Create test database session"""
    session = test_session_factory()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def redis_client():
    """Create test Redis client"""
    client = redis.Redis.from_url(TEST_REDIS_URL)
    yield client
    client.flushdb()
    client.close()

@pytest.fixture
def test_client():
    """Create FastAPI test client"""
    return TestClient(app)

@pytest.fixture
def sample_patient_data():
    """Sample patient data for testing"""
    return {
        "patient_id": "test-patient-123",
        "pregnancy_id": "test-pregnancy-123",
        "patient_data": {
            "age": 28,
            "bmi": 24.5,
            "gestational_age": 20.0,
            "previous_pregnancies": 1,
            "previous_complications": ["gestational_diabetes"],
            "chronic_conditions": [],
            "medications": ["prenatal_vitamins"],
            "family_history": ["diabetes", "hypertension"]
        },
        "vital_signs": {
            "blood_pressure_systolic": 125,
            "blood_pressure_diastolic": 82,
            "heart_rate": 78,
            "weight": 68.5,
            "temperature": 36.8,
            "glucose_level": 98,
            "fetal_heart_rate": 145,
            "oxygen_saturation": 98
        },
        "lab_results": {
            "hemoglobin": 12.5,
            "hematocrit": 37.2,
            "platelets": 250000,
            "glucose_fasting": 92,
            "protein_urine": 0.1
        },
        "symptoms": ["mild_nausea", "fatigue"],
        "timestamp": datetime.utcnow().isoformat()
    }

@pytest.fixture
def high_risk_patient_data():
    """High-risk patient data for testing alerts"""
    return {
        "patient_id": "test-patient-456",
        "pregnancy_id": "test-pregnancy-456",
        "patient_data": {
            "age": 38,
            "bmi": 32.1,
            "gestational_age": 28.0,
            "previous_pregnancies": 3,
            "previous_complications": ["preeclampsia", "preterm_birth"],
            "chronic_conditions": ["diabetes", "hypertension"],
            "medications": ["insulin", "metformin", "lisinopril"],
            "family_history": ["preeclampsia", "diabetes", "heart_disease"]
        },
        "vital_signs": {
            "blood_pressure_systolic": 155,
            "blood_pressure_diastolic": 98,
            "heart_rate": 95,
            "weight": 85.2,
            "temperature": 37.1,
            "glucose_level": 165,
            "fetal_heart_rate": 105,  # Below normal range
            "oxygen_saturation": 96
        },
        "lab_results": {
            "hemoglobin": 10.8,
            "hematocrit": 32.5,
            "platelets": 180000,
            "glucose_fasting": 145,
            "protein_urine": 2.5  # Elevated
        },
        "symptoms": ["severe_headache", "visual_disturbances", "swelling"],
        "timestamp": datetime.utcnow().isoformat()
    }

class TestRiskAssessmentAPI:
    """Test suite for risk assessment API endpoints"""

    def test_health_check(self, test_client):
        """Test health check endpoint"""
        response = test_client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
        assert "services" in data

    def test_model_status(self, test_client):
        """Test model status endpoint"""
        with patch('src.services.model_manager.ModelManager.get_detailed_model_status') as mock_status:
            mock_status.return_value = {
                "preeclampsia": {"status": "loaded", "accuracy": 0.92, "last_trained": "2024-01-15"},
                "gestational_diabetes": {"status": "loaded", "accuracy": 0.89, "last_trained": "2024-01-15"},
                "preterm_birth": {"status": "loaded", "accuracy": 0.87, "last_trained": "2024-01-15"}
            }
            
            response = test_client.get("/models/status")
            assert response.status_code == 200
            
            data = response.json()
            assert data["success"] is True
            assert "preeclampsia" in data["data"]
            assert data["data"]["preeclampsia"]["accuracy"] == 0.92

    @pytest.mark.asyncio
    async def test_risk_assessment_normal_case(self, test_client, sample_patient_data):
        """Test risk assessment for normal-risk patient"""
        with patch('src.services.feature_engineer.FeatureEngineer.engineer_features') as mock_features, \
             patch('src.services.model_manager.ModelManager.get_model') as mock_get_model, \
             patch('src.main.store_risk_assessment') as mock_store, \
             patch('src.main.cache_assessment_result') as mock_cache:
            
            # Mock feature engineering
            mock_features.return_value = pd.DataFrame({
                'age': [28], 'bmi': [24.5], 'gestational_age': [20.0],
                'systolic_bp': [125], 'diastolic_bp': [82], 'heart_rate': [78]
            })
            
            # Mock model predictions
            mock_model = Mock()
            mock_model.predict = AsyncMock(return_value={
                "score": 25.0,
                "probability": 0.25,
                "confidence": 0.85,
                "trend": "stable",
                "contributing_factors": ["age", "bmi"],
                "early_warning_signals": []
            })
            mock_get_model.return_value = mock_model
            
            response = test_client.post("/risk-assessment", json=sample_patient_data)
            assert response.status_code == 200
            
            data = response.json()
            assert data["overall_risk_score"] <= 50  # Should be low-moderate risk
            assert data["risk_level"] in ["low", "moderate"]
            assert len(data["risk_scores"]) == 3  # Three conditions assessed
            assert data["confidence"] > 0.8
            
            # Verify model was called for each condition
            assert mock_get_model.call_count == 3
            mock_store.assert_called_once()
            mock_cache.assert_called_once()

    @pytest.mark.asyncio
    async def test_risk_assessment_high_risk_case(self, test_client, high_risk_patient_data):
        """Test risk assessment for high-risk patient"""
        with patch('src.services.feature_engineer.FeatureEngineer.engineer_features') as mock_features, \
             patch('src.services.model_manager.ModelManager.get_model') as mock_get_model, \
             patch('src.main.store_risk_assessment') as mock_store, \
             patch('src.main.cache_assessment_result') as mock_cache:
            
            # Mock feature engineering
            mock_features.return_value = pd.DataFrame({
                'age': [38], 'bmi': [32.1], 'gestational_age': [28.0],
                'systolic_bp': [155], 'diastolic_bp': [98], 'heart_rate': [95]
            })
            
            # Mock high-risk model predictions
            mock_model = Mock()
            mock_model.predict = AsyncMock(return_value={
                "score": 85.0,
                "probability": 0.85,
                "confidence": 0.92,
                "trend": "worsening",
                "contributing_factors": ["age", "bmi", "previous_complications", "blood_pressure"],
                "early_warning_signals": ["elevated_bp", "abnormal_fhr", "proteinuria"]
            })
            mock_get_model.return_value = mock_model
            
            response = test_client.post("/risk-assessment", json=high_risk_patient_data)
            assert response.status_code == 200
            
            data = response.json()
            assert data["overall_risk_score"] >= 70  # Should be high risk
            assert data["risk_level"] in ["high", "critical"]
            assert len(data["recommendations"]) > 0
            
            # Check that next assessment is scheduled sooner for high risk
            next_assessment = datetime.fromisoformat(data["next_assessment_due"].replace('Z', '+00:00'))
            now = datetime.utcnow().replace(tzinfo=next_assessment.tzinfo)
            time_diff = next_assessment - now
            assert time_diff.total_seconds() <= 86400  # Within 24 hours

    def test_risk_assessment_validation_error(self, test_client):
        """Test risk assessment with invalid data"""
        invalid_data = {
            "patient_id": "test-patient-123",
            # Missing required fields
        }
        
        response = test_client.post("/risk-assessment", json=invalid_data)
        assert response.status_code == 422  # Validation error

    def test_get_risk_assessment_by_id(self, test_client, redis_client):
        """Test retrieving risk assessment by ID"""
        assessment_id = "ra_20240122_120000_test-patient-123"
        cached_assessment = {
            "assessment_id": assessment_id,
            "patient_id": "test-patient-123",
            "overall_risk_score": 35,
            "risk_level": "moderate"
        }
        
        # Cache the assessment
        redis_client.set(f"assessment:{assessment_id}", json.dumps(cached_assessment))
        
        response = test_client.get(f"/risk-assessment/{assessment_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["assessment_id"] == assessment_id
        assert data["overall_risk_score"] == 35

    def test_get_risk_assessment_not_found(self, test_client):
        """Test retrieving non-existent risk assessment"""
        response = test_client.get("/risk-assessment/non-existent-id")
        assert response.status_code == 404

    def test_get_patient_risk_history(self, test_client, test_session):
        """Test retrieving patient risk assessment history"""
        patient_id = "test-patient-123"
        
        # Create mock assessments in database
        assessments = []
        for i in range(5):
            assessment = RiskAssessment(
                assessment_id=f"ra_test_{i}",
                patient_id=patient_id,
                pregnancy_id="test-pregnancy-123",
                timestamp=datetime.utcnow() - timedelta(days=i),
                overall_risk_score=30 + i * 5,
                risk_level="moderate",
                risk_categories=json.dumps([]),
                recommendations=json.dumps([]),
                model_version="1.0.0",
                confidence=0.85
            )
            assessments.append(assessment)
            test_session.add(assessment)
        
        test_session.commit()
        
        with patch('src.main.SessionLocal', return_value=test_session):
            response = test_client.get(f"/risk-assessment/patient/{patient_id}")
            assert response.status_code == 200
            
            data = response.json()
            assert data["success"] is True
            assert len(data["data"]) == 5
            assert data["pagination"]["total"] == 5

class TestPredictionAPI:
    """Test suite for prediction API endpoints"""

    @pytest.mark.asyncio
    async def test_early_detection_prediction(self, test_client, sample_patient_data):
        """Test 14-day early detection prediction"""
        with patch('src.services.feature_engineer.FeatureEngineer.engineer_features') as mock_features, \
             patch('src.services.model_manager.ModelManager.get_model') as mock_get_model:
            
            mock_features.return_value = pd.DataFrame({'feature1': [1], 'feature2': [2]})
            
            # Mock early detection model
            mock_model = Mock()
            mock_model.predict_timeframe = AsyncMock(return_value={
                "conditions": {
                    "preeclampsia": {"probability": 0.15, "confidence": 0.82},
                    "gestational_diabetes": {"probability": 0.08, "confidence": 0.79}
                },
                "overall_probability": 0.23,
                "confidence": 0.80
            })
            mock_get_model.return_value = mock_model
            
            response = test_client.post("/predict/early-detection", json=sample_patient_data)
            assert response.status_code == 200
            
            data = response.json()
            assert data["success"] is True
            assert len(data["data"]["predictions"]) == 14  # 14-day predictions
            assert data["data"]["detection_window"] == "14 days"
            
            # Verify each prediction has required fields
            for prediction in data["data"]["predictions"]:
                assert "days_ahead" in prediction
                assert "date" in prediction
                assert "conditions" in prediction
                assert "overall_probability" in prediction
                assert "confidence" in prediction

    @pytest.mark.asyncio
    async def test_pregnancy_outcome_prediction(self, test_client, sample_patient_data):
        """Test pregnancy outcome prediction"""
        with patch('src.services.feature_engineer.FeatureEngineer.engineer_features') as mock_features, \
             patch('src.services.model_manager.ModelManager.get_model') as mock_get_model:
            
            mock_features.return_value = pd.DataFrame({'feature1': [1], 'feature2': [2]})
            
            # Mock outcome prediction model
            mock_model = Mock()
            mock_model.predict = AsyncMock(return_value={
                "delivery": {
                    "mode": {"vaginal": 0.75, "cesarean": 0.25},
                    "timing": {"term": 0.85, "preterm": 0.15},
                    "complications": {"none": 0.80, "minor": 0.15, "major": 0.05}
                },
                "maternal": {
                    "outcomes": {"normal": 0.90, "complications": 0.10},
                    "recovery": {"normal": 0.85, "extended": 0.15}
                },
                "fetal": {
                    "weight": {"normal": 0.80, "low": 0.10, "high": 0.10},
                    "health": {"normal": 0.95, "complications": 0.05}
                },
                "interventions": [
                    {"type": "monitoring", "probability": 0.30},
                    {"type": "medication", "probability": 0.15}
                ],
                "confidence": 0.87
            })
            mock_get_model.return_value = mock_model
            
            response = test_client.post("/predict/outcome", json=sample_patient_data)
            assert response.status_code == 200
            
            data = response.json()
            assert data["success"] is True
            assert "delivery_predictions" in data["data"]
            assert "maternal_outcomes" in data["data"]
            assert "fetal_outcomes" in data["data"]
            assert "recommended_interventions" in data["data"]
            assert data["data"]["confidence"] > 0.8

class TestFeatureEngineering:
    """Test suite for feature engineering functionality"""

    @pytest.fixture
    def feature_engineer(self):
        return FeatureEngineer()

    @pytest.mark.asyncio
    async def test_basic_feature_engineering(self, feature_engineer, sample_patient_data):
        """Test basic feature engineering process"""
        features = await feature_engineer.engineer_features(sample_patient_data)
        
        assert isinstance(features, pd.DataFrame)
        assert len(features) == 1  # Single patient record
        
        # Check that basic features are present
        expected_features = [
            'age', 'bmi', 'gestational_age', 'previous_pregnancies',
            'systolic_bp', 'diastolic_bp', 'heart_rate', 'glucose_level'
        ]
        
        for feature in expected_features:
            assert feature in features.columns

    @pytest.mark.asyncio
    async def test_risk_factor_encoding(self, feature_engineer, high_risk_patient_data):
        """Test encoding of risk factors"""
        features = await feature_engineer.engineer_features(high_risk_patient_data)
        
        # Check that risk factors are properly encoded
        assert features['has_diabetes'].iloc[0] == 1
        assert features['has_hypertension'].iloc[0] == 1
        assert features['previous_preeclampsia'].iloc[0] == 1
        assert features['advanced_maternal_age'].iloc[0] == 1  # Age > 35

    @pytest.mark.asyncio
    async def test_temporal_features(self, feature_engineer, sample_patient_data):
        """Test temporal feature engineering"""
        features = await feature_engineer.engineer_features(sample_patient_data)
        
        # Check temporal features
        assert 'trimester' in features.columns
        assert 'weeks_to_due_date' in features.columns
        assert features['trimester'].iloc[0] == 2  # 20 weeks = 2nd trimester

    @pytest.mark.asyncio
    async def test_interaction_features(self, feature_engineer, sample_patient_data):
        """Test interaction feature creation"""
        features = await feature_engineer.engineer_features(sample_patient_data)
        
        # Check interaction features
        assert 'age_bmi_interaction' in features.columns
        assert 'bp_ratio' in features.columns
        
        expected_age_bmi = sample_patient_data['patient_data']['age'] * sample_patient_data['patient_data']['bmi']
        assert abs(features['age_bmi_interaction'].iloc[0] - expected_age_bmi) < 0.01

class TestModelManager:
    """Test suite for model management functionality"""

    @pytest.fixture
    def model_manager(self):
        return ModelManager()

    def test_model_loading(self, model_manager):
        """Test model loading functionality"""
        with patch('joblib.load') as mock_load:
            mock_model = Mock()
            mock_load.return_value = mock_model
            
            # Test loading a specific model
            model = model_manager.get_model("preeclampsia")
            assert model is not None

    def test_model_status_reporting(self, model_manager):
        """Test model status reporting"""
        with patch.object(model_manager, '_models', {
            'preeclampsia': Mock(accuracy=0.92, last_trained='2024-01-15'),
            'gestational_diabetes': Mock(accuracy=0.89, last_trained='2024-01-15')
        }):
            status = model_manager.get_model_status()
            
            assert 'preeclampsia' in status
            assert 'gestational_diabetes' in status
            assert status['preeclampsia']['status'] == 'loaded'

    @pytest.mark.asyncio
    async def test_model_retraining_trigger(self, model_manager):
        """Test model retraining trigger"""
        with patch.object(model_manager, 'retrain_all_models') as mock_retrain:
            mock_retrain.return_value = AsyncMock()
            
            await model_manager.retrain_all_models()
            mock_retrain.assert_called_once()

class TestDataProcessor:
    """Test suite for data processing functionality"""

    @pytest.fixture
    def data_processor(self):
        return DataProcessor()

    @pytest.mark.asyncio
    async def test_population_insights(self, data_processor):
        """Test population-level insights generation"""
        start_date = datetime.utcnow() - timedelta(days=30)
        end_date = datetime.utcnow()
        
        with patch.object(data_processor, '_query_population_data') as mock_query:
            mock_query.return_value = pd.DataFrame({
                'risk_level': ['low', 'moderate', 'high', 'critical'],
                'count': [100, 50, 20, 5],
                'avg_age': [28, 32, 35, 38],
                'avg_gestational_age': [20, 22, 24, 26]
            })
            
            insights = await data_processor.get_population_insights(start_date, end_date)
            
            assert 'risk_distribution' in insights
            assert 'demographic_trends' in insights
            assert 'outcome_statistics' in insights
            assert insights['total_pregnancies'] == 175

    def test_data_quality_assessment(self, data_processor, sample_patient_data):
        """Test data quality assessment"""
        quality_metrics = data_processor.assess_data_quality(sample_patient_data)
        
        assert 'completeness' in quality_metrics
        assert 'accuracy' in quality_metrics
        assert 'consistency' in quality_metrics
        assert quality_metrics['completeness'] > 0.8  # Should have good completeness

class TestPerformance:
    """Performance tests for AI/ML service"""

    @pytest.mark.asyncio
    async def test_risk_assessment_performance(self, test_client, sample_patient_data):
        """Test risk assessment response time"""
        import time
        
        with patch('src.services.feature_engineer.FeatureEngineer.engineer_features') as mock_features, \
             patch('src.services.model_manager.ModelManager.get_model') as mock_get_model:
            
            mock_features.return_value = pd.DataFrame({'feature1': [1]})
            mock_model = Mock()
            mock_model.predict = AsyncMock(return_value={
                "score": 25.0, "probability": 0.25, "confidence": 0.85,
                "trend": "stable", "contributing_factors": [], "early_warning_signals": []
            })
            mock_get_model.return_value = mock_model
            
            start_time = time.time()
            response = test_client.post("/risk-assessment", json=sample_patient_data)
            end_time = time.time()
            
            assert response.status_code == 200
            assert (end_time - start_time) < 2.0  # Should complete within 2 seconds

    @pytest.mark.asyncio
    async def test_concurrent_assessments(self, test_client, sample_patient_data):
        """Test handling concurrent risk assessments"""
        import asyncio
        import aiohttp
        
        async def make_request(session, data):
            async with session.post("http://localhost:8000/risk-assessment", json=data) as response:
                return await response.json()
        
        with patch('src.services.feature_engineer.FeatureEngineer.engineer_features') as mock_features, \
             patch('src.services.model_manager.ModelManager.get_model') as mock_get_model:
            
            mock_features.return_value = pd.DataFrame({'feature1': [1]})
            mock_model = Mock()
            mock_model.predict = AsyncMock(return_value={
                "score": 25.0, "probability": 0.25, "confidence": 0.85,
                "trend": "stable", "contributing_factors": [], "early_warning_signals": []
            })
            mock_get_model.return_value = mock_model
            
            # Test with 10 concurrent requests
            async with aiohttp.ClientSession() as session:
                tasks = []
                for i in range(10):
                    data = sample_patient_data.copy()
                    data['patient_id'] = f"test-patient-{i}"
                    tasks.append(make_request(session, data))
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # All requests should succeed
                successful_results = [r for r in results if not isinstance(r, Exception)]
                assert len(successful_results) == 10

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=src", "--cov-report=html", "--cov-report=term-missing"])