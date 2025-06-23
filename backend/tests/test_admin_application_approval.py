"""
Test Admin Application Approval/Rejection Endpoints
Task 10: Backend API for Application Approval/Rejection
"""

import pytest
import json
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from backend.api import app

# Test client
client = TestClient(app)

# Mock application data for testing
MOCK_APPLICATION = {
    'id': 'app-123',
    'user_id': 'user-456',
    'full_name': 'John Doe',
    'email': 'john.doe@example.com',
    'bio': 'Experienced tech writer',
    'motivation': 'Want to share knowledge',
    'status': 'pending',
    'submitted_at': '2024-01-15T10:00:00Z'
}

@pytest.fixture
def mock_supabase_admin_client():
    """Mock Supabase admin client for testing"""
    mock_client = AsyncMock()
    mock_client.table.return_value = mock_client
    mock_client.select.return_value = mock_client
    mock_client.eq.return_value = mock_client
    mock_client.update.return_value = mock_client
    mock_client.insert.return_value = mock_client
    mock_client.execute = AsyncMock()
    mock_client.close = AsyncMock()
    return mock_client

@pytest.fixture
def mock_application_data():
    """Sample application data for testing"""
    return {
        'id': 'app-123',
        'user_id': 'user-456',
        'full_name': 'John Doe',
        'email': 'john.doe@example.com',
        'bio': 'Experienced tech writer',
        'motivation': 'Want to share knowledge',
        'status': 'pending',
        'submitted_at': '2024-01-15T10:00:00Z',
        'reviewed_by': None,
        'reviewed_at': None,
        'review_notes': None,
        'rejection_reason': None
    }

@pytest.fixture
def mock_admin_user():
    """Mock admin user data"""
    return {
        'user_id': 'admin-789',
        'email': 'admin@example.com',
        'is_global_admin': True
    }

class TestApplicationApproval:
    """Test cases for POST /admin/applications/{application_id}/approve"""

    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.articles_email_service')
    def test_approve_application_success(self, mock_email, mock_auth, mock_supabase):
        """Test successful application approval"""
        # Setup mocks
        mock_client = AsyncMock()
        mock_supabase.return_value = mock_client
        mock_auth.return_value = 'admin-789'
        mock_email.send_application_notification.return_value = True
        
        # Mock database responses
        mock_client.table.return_value = mock_client
        mock_client.select.return_value = mock_client
        mock_client.eq.return_value = mock_client
        mock_client.update.return_value = mock_client
        mock_client.insert.return_value = mock_client
        mock_client.execute.side_effect = [
            AsyncMock(data=[MOCK_APPLICATION]),  # Application lookup
            AsyncMock(data=[{**MOCK_APPLICATION, 'status': 'approved'}]),  # Update
            AsyncMock(data=[{'id': 'audit-123'}])  # Audit log
        ]
        
        response = client.post(
            f"/admin/applications/{MOCK_APPLICATION['id']}/approve",
            json={'review_notes': 'Excellent writing portfolio'},
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result['message'] == 'Application approved successfully'
        assert result['application_id'] == MOCK_APPLICATION['id']

    def test_approve_application_missing_review_notes(self):
        """Test approval fails when review_notes is missing"""
        with patch('services.admin_api.require_global_admin', return_value='admin-789'):
            response = client.post(
                "/admin/applications/app-123/approve",
                json={},  # No review_notes
                headers={'Authorization': 'Bearer test-token'}
            )
            
            assert response.status_code == 400
            assert 'review_notes field is mandatory' in response.json()['detail']

    @patch('services.admin_api.require_global_admin')
    def test_approve_application_empty_review_notes(self, mock_auth, mock_admin_user):
        """Test approval fails when review_notes is empty string"""
        mock_auth.return_value = mock_admin_user['user_id']
        
        response = client.post(
            "/admin/applications/app-123/approve",
            json={'review_notes': '   '},  # Empty/whitespace only
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 400
        assert 'review_notes field is mandatory' in response.json()['detail']

    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    def test_approve_application_not_found(
        self, 
        mock_auth, 
        mock_supabase, 
        mock_supabase_admin_client, 
        mock_admin_user
    ):
        """Test approval fails when application doesn't exist"""
        mock_supabase.return_value = mock_supabase_admin_client
        mock_auth.return_value = mock_admin_user['user_id']
        
        # Mock application not found
        mock_supabase_admin_client.execute.return_value = AsyncMock(data=[])
        
        response = client.post(
            "/admin/applications/nonexistent-app/approve",
            json={'review_notes': 'Test notes'},
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 404
        assert 'Application not found' in response.json()['detail']

    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    def test_approve_already_processed_application(
        self, 
        mock_auth, 
        mock_supabase, 
        mock_supabase_admin_client, 
        mock_application_data, 
        mock_admin_user
    ):
        """Test approval fails when application is already processed"""
        mock_supabase.return_value = mock_supabase_admin_client
        mock_auth.return_value = mock_admin_user['user_id']
        
        # Mock already approved application
        approved_app = {**mock_application_data, 'status': 'approved'}
        mock_supabase_admin_client.execute.return_value = AsyncMock(data=[approved_app])
        
        response = client.post(
            f"/admin/applications/{mock_application_data['id']}/approve",
            json={'review_notes': 'Test notes'},
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 400
        assert 'Application has already been approved' in response.json()['detail']

class TestApplicationRejection:
    """Test cases for POST /admin/applications/{application_id}/reject"""

    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.articles_email_service')
    def test_reject_application_success(self, mock_email, mock_auth, mock_supabase):
        """Test successful application rejection"""
        # Setup mocks
        mock_client = AsyncMock()
        mock_supabase.return_value = mock_client
        mock_auth.return_value = 'admin-789'
        mock_email.send_application_notification.return_value = True
        
        # Mock database responses
        mock_client.table.return_value = mock_client
        mock_client.select.return_value = mock_client
        mock_client.eq.return_value = mock_client
        mock_client.update.return_value = mock_client
        mock_client.insert.return_value = mock_client
        mock_client.execute.side_effect = [
            AsyncMock(data=[MOCK_APPLICATION]),
            AsyncMock(data=[{**MOCK_APPLICATION, 'status': 'rejected'}]),
            AsyncMock(data=[{'id': 'audit-123'}])
        ]
        
        response = client.post(
            f"/admin/applications/{MOCK_APPLICATION['id']}/reject",
            json={
                'review_notes': 'Portfolio does not meet standards',
                'rejection_reason': 'Insufficient experience'
            },
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result['message'] == 'Application rejected successfully'
        assert result['application_id'] == MOCK_APPLICATION['id']
        assert result['rejection_reason'] == 'Insufficient experience'

    def test_reject_application_missing_review_notes(self):
        """Test rejection fails when review_notes is missing"""
        with patch('services.admin_api.require_global_admin', return_value='admin-789'):
            response = client.post(
                "/admin/applications/app-123/reject",
                json={'rejection_reason': 'Some reason'},  # No review_notes
                headers={'Authorization': 'Bearer test-token'}
            )
            
            assert response.status_code == 400
            assert 'review_notes field is mandatory' in response.json()['detail']

class TestAuthenticationAndAuthorization:
    """Test authentication and authorization for application endpoints"""

    def test_approve_application_no_auth(self):
        """Test approval fails without authentication"""
        response = client.post(
            "/admin/applications/app-123/approve",
            json={'review_notes': 'Test notes'}
        )
        
        assert response.status_code == 401

    def test_reject_application_no_auth(self):
        """Test rejection fails without authentication"""
        response = client.post(
            "/admin/applications/app-123/reject",
            json={'review_notes': 'Test notes'}
        )
        
        assert response.status_code == 401

    @patch('services.admin_api.require_global_admin')
    def test_approve_application_non_admin(self, mock_auth):
        """Test approval fails for non-admin user"""
        # Mock auth to raise exception for non-admin
        mock_auth.side_effect = Exception("Access denied: User is not a global administrator")
        
        response = client.post(
            "/admin/applications/app-123/approve",
            json={'review_notes': 'Test notes'},
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 403

class TestEmailNotifications:
    """Test email notification functionality"""

    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.articles_email_service')
    def test_email_notification_failure_logged(
        self, 
        mock_email_service, 
        mock_auth, 
        mock_supabase, 
        mock_supabase_admin_client, 
        mock_application_data, 
        mock_admin_user
    ):
        """Test that email notification failures are logged but don't fail the request"""
        mock_supabase.return_value = mock_supabase_admin_client
        mock_auth.return_value = mock_admin_user['user_id']
        
        # Mock email service failure
        mock_email_service.send_application_notification.return_value = False
        
        mock_supabase_admin_client.execute.side_effect = [
            AsyncMock(data=[mock_application_data]),
            AsyncMock(data=[{**mock_application_data, 'status': 'approved'}]),
            AsyncMock(data=[{'id': 'audit-123'}])
        ]
        
        response = client.post(
            f"/admin/applications/{mock_application_data['id']}/approve",
            json={'review_notes': 'Test approval'},
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result['email_sent'] is False  # Email failed but request succeeded

class TestAuditLogging:
    """Test audit logging functionality"""

    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.articles_email_service')
    def test_audit_log_created_on_approval(
        self, 
        mock_email_service, 
        mock_auth, 
        mock_supabase, 
        mock_supabase_admin_client, 
        mock_application_data, 
        mock_admin_user
    ):
        """Test that audit log is created when application is approved"""
        mock_supabase.return_value = mock_supabase_admin_client
        mock_auth.return_value = mock_admin_user['user_id']
        mock_email_service.send_application_notification.return_value = True
        
        # Capture the audit log insert call
        audit_insert_call = None
        
        def mock_insert(data):
            nonlocal audit_insert_call
            audit_insert_call = data
            return mock_supabase_admin_client
        
        mock_supabase_admin_client.insert.side_effect = mock_insert
        mock_supabase_admin_client.execute.side_effect = [
            AsyncMock(data=[mock_application_data]),
            AsyncMock(data=[{**mock_application_data, 'status': 'approved'}]),
            AsyncMock(data=[{'id': 'audit-123'}])
        ]
        
        response = client.post(
            f"/admin/applications/{mock_application_data['id']}/approve",
            json={'review_notes': 'Excellent portfolio'},
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 200
        
        # Verify audit log data
        assert audit_insert_call is not None
        assert audit_insert_call['action_by_user_id'] == mock_admin_user['user_id']
        assert audit_insert_call['action_type'] == 'application_approved'
        assert audit_insert_call['target_entity_type'] == 'application'
        assert audit_insert_call['target_entity_id'] == mock_application_data['id']
        assert audit_insert_call['justification'] == 'Excellent portfolio'
        
        details = audit_insert_call['details']
        assert details['applicant_name'] == mock_application_data['full_name']
        assert details['applicant_email'] == mock_application_data['email']

class TestDataValidation:
    """Test data validation and edge cases"""

    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    def test_whitespace_review_notes_rejected(
        self, 
        mock_auth, 
        mock_supabase, 
        mock_supabase_admin_client, 
        mock_admin_user
    ):
        """Test that whitespace-only review notes are rejected"""
        mock_supabase.return_value = mock_supabase_admin_client
        mock_auth.return_value = mock_admin_user['user_id']
        
        response = client.post(
            "/admin/applications/app-123/approve",
            json={'review_notes': '   \n\t   '},  # Only whitespace
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 400
        assert 'review_notes field is mandatory' in response.json()['detail']

    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.articles_email_service')
    def test_review_notes_trimmed(
        self, 
        mock_email_service, 
        mock_auth, 
        mock_supabase, 
        mock_supabase_admin_client, 
        mock_application_data, 
        mock_admin_user
    ):
        """Test that review notes are properly trimmed"""
        mock_supabase.return_value = mock_supabase_admin_client
        mock_auth.return_value = mock_admin_user['user_id']
        mock_email_service.send_application_notification.return_value = True
        
        # Capture the update call to verify trimming
        update_data_call = None
        
        def mock_update(data):
            nonlocal update_data_call
            update_data_call = data
            return mock_supabase_admin_client
        
        mock_supabase_admin_client.update.side_effect = mock_update
        mock_supabase_admin_client.execute.side_effect = [
            AsyncMock(data=[mock_application_data]),
            AsyncMock(data=[{**mock_application_data, 'status': 'approved'}]),
            AsyncMock(data=[{'id': 'audit-123'}])
        ]
        
        response = client.post(
            f"/admin/applications/{mock_application_data['id']}/approve",
            json={'review_notes': '  Great application!  '},  # Has leading/trailing spaces
            headers={'Authorization': 'Bearer test-token'}
        )
        
        assert response.status_code == 200
        assert update_data_call['review_notes'] == 'Great application!'  # Trimmed

if __name__ == '__main__':
    pytest.main([__file__, '-v']) 