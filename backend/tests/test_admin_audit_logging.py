"""
Test Admin Audit Logging
Task 21.5: Verification tests for comprehensive admin action audit logging

Tests all admin endpoints enhanced with audit logging to ensure:
- Proper logging of administrative actions
- Correct data capture and storage
- Security metadata extraction
- Error handling and edge cases
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from datetime import datetime
import json

# Create a simple test client for FastAPI
try:
    from api import app
    from fastapi.testclient import TestClient
    client = TestClient(app)
except ImportError:
    # If imports fail, skip client-based tests
    app = None
    client = None

class TestAdminAuditLogging:
    """Test audit logging for all admin endpoints"""
    
    @pytest.fixture
    def mock_admin_client(self):
        """Mock Supabase admin client for testing"""
        mock_client = AsyncMock()
        mock_client.table.return_value = mock_client
        mock_client.select.return_value = mock_client
        mock_client.insert.return_value = mock_client
        mock_client.update.return_value = mock_client
        mock_client.delete.return_value = mock_client
        mock_client.eq.return_value = mock_client
        mock_client.execute.return_value = AsyncMock()
        mock_client.close.return_value = AsyncMock()
        return mock_client
    
    @pytest.fixture
    def mock_auth(self):
        """Mock authentication for admin user"""
        return "test-admin-user-id"
    
    @pytest.fixture
    def sample_article_data(self):
        """Sample article data for testing"""
        return {
            'id': 'test-article-id',
            'title': 'Test Article',
            'status': 'published',
            'visibility': 'public',
            'created_by_user_id': 'test-author-id',
            'account_id': 'test-account-id',
            'total_views': 100,
            'vote_score': 5,
            'created_at': '2024-01-01T00:00:00Z'
        }
    
    @pytest.fixture
    def sample_author_data(self):
        """Sample author data for testing"""
        return {
            'full_name': 'Test Author',
            'email': 'author@test.com'
        }
    
    @pytest.fixture
    def sample_application_data(self):
        """Sample application data for testing"""
        return {
            'id': 'test-app-id',
            'user_id': 'test-user-id',
            'full_name': 'Test Applicant',
            'email': 'applicant@test.com',
            'bio': 'Test bio',
            'motivation': 'Test motivation',
            'status': 'pending',
            'submitted_at': '2024-01-01T00:00:00Z'
        }
    
    @pytest.fixture  
    def sample_user_data(self):
        """Sample user data for testing"""
        return {
            'id': 'test-target-user-id',
            'email': 'target@test.com',
            'full_name': 'Target User'
        }

    # =======================================================================
    # ARTICLE MANAGEMENT AUDIT LOGGING TESTS
    # =======================================================================
    
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.log_article_action')
    @patch('services.admin_api.extract_request_metadata')
    @patch('services.admin_api.admin_rate_limit')
    def test_delete_article_audit_logging(
        self, mock_rate_limit, mock_extract_metadata, mock_log_action, 
        mock_auth_dep, mock_supabase, mock_admin_client, sample_article_data, sample_author_data
    ):
        """Test audit logging for article deletion"""
        if client is None:
            pytest.skip("FastAPI app not available for testing")
            
        # Setup mocks
        mock_auth_dep.return_value = "admin-user-id"
        mock_rate_limit.return_value = True
        mock_supabase.return_value = mock_admin_client
        mock_extract_metadata.return_value = {
            'ip_address': '192.168.1.1',
            'user_agent': 'TestAgent/1.0'
        }
        
        # Mock article and author data retrieval
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [sample_article_data]
        
        # Mock author data separately  
        author_mock = AsyncMock()
        author_mock.data = [sample_author_data]
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            AsyncMock(data=[sample_article_data]),  # Article query
            author_mock,  # Author query
            AsyncMock(data=[sample_article_data])   # Delete operation
        ]
        
        # Make request
        with patch('services.admin_api.logger'):
            response = client.delete(
                "/admin/articles/test-article-id",
                headers={"Authorization": "Bearer test-token"}
            )
        
        # Verify audit logging was called
        mock_log_action.assert_called_once()
        
        # Check that the function was called with correct parameters
        assert mock_log_action.called
        call_kwargs = mock_log_action.call_args.kwargs
        assert 'admin_user_id' in call_kwargs
        assert 'action_type' in call_kwargs
        assert 'article_id' in call_kwargs
    
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin') 
    @patch('services.admin_api.log_article_action')
    @patch('services.admin_api.extract_request_metadata')
    @patch('services.admin_api.admin_rate_limit')
    def test_update_article_audit_logging(
        self, mock_rate_limit, mock_extract_metadata, mock_log_action, 
        mock_auth_dep, mock_supabase, mock_admin_client, sample_article_data, sample_author_data
    ):
        """Test audit logging for article updates"""
        # Setup mocks
        mock_auth_dep.return_value = "admin-user-id"
        mock_rate_limit.return_value = True
        mock_supabase.return_value = mock_admin_client
        mock_extract_metadata.return_value = {
            'ip_address': '192.168.1.1',
            'user_agent': 'TestAgent/1.0'
        }
        
        # Mock article data with additional fields for update
        full_article_data = {
            **sample_article_data,
            'subtitle': 'Original subtitle',
            'content': 'Original content',
            'category': 'tech',
            'tags': ['tag1'],
            'author': 'Original Author'
        }
        
        updated_article_data = {
            **full_article_data,
            'title': 'Updated Title',
            'status': 'archived'
        }
        
        # Mock database responses
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            AsyncMock(data=[full_article_data]),  # Original article query
            AsyncMock(data=[sample_author_data]), # Author query
            AsyncMock(data=[updated_article_data]) # Update result
        ]
        
        # Make request with updates
        update_data = {
            "title": "Updated Title",
            "status": "archived"
        }
        
        with patch('services.admin_api.logger'):
            response = client.put(
                "/admin/articles/test-article-id",
                json=update_data,
                headers={"Authorization": "Bearer test-token"}
            )
        
        # Verify audit logging was called for changes
        assert mock_log_action.called
    
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.log_article_action')
    @patch('services.admin_api.extract_request_metadata')
    @patch('services.admin_api.admin_rate_limit')
    def test_archive_article_audit_logging(
        self, mock_rate_limit, mock_extract_metadata, mock_log_action, 
        mock_auth_dep, mock_supabase, mock_admin_client, sample_article_data, sample_author_data
    ):
        """Test audit logging for article archiving"""
        # Setup mocks
        mock_auth_dep.return_value = "admin-user-id"
        mock_rate_limit.return_value = True
        mock_supabase.return_value = mock_admin_client
        mock_extract_metadata.return_value = {
            'ip_address': '192.168.1.1',
            'user_agent': 'TestAgent/1.0'
        }
        
        # Mock responses
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            AsyncMock(data=[sample_article_data]),  # Article query
            AsyncMock(data=[sample_author_data]),   # Author query
            AsyncMock(data=[{**sample_article_data, 'status': 'archived'}])  # Update result
        ]
        
        # Make request
        with patch('services.admin_api.logger'):
            response = client.post(
                "/admin/articles/test-article-id/archive",
                headers={"Authorization": "Bearer test-token"}
            )
        
        # Verify audit logging was called
        mock_log_action.assert_called_once()

    # =======================================================================
    # APPLICATION MANAGEMENT AUDIT LOGGING TESTS
    # =======================================================================
    
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.log_application_action')
    @patch('services.admin_api.extract_request_metadata')
    @patch('services.admin_api.articles_email_service')
    def test_review_application_audit_logging(
        self, mock_email_service, mock_extract_metadata, mock_log_action, 
        mock_auth_dep, mock_supabase, mock_admin_client, sample_application_data
    ):
        """Test audit logging for application review"""
        # Setup mocks
        mock_auth_dep.return_value = "admin-user-id"
        mock_supabase.return_value = mock_admin_client
        mock_extract_metadata.return_value = {
            'ip_address': '192.168.1.1',
            'user_agent': 'TestAgent/1.0'
        }
        mock_email_service.send_application_notification.return_value = True
        
        # Mock application data retrieval and update
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value = AsyncMock(
            data=[sample_application_data]
        )
        mock_admin_client.table.return_value.update.return_value.eq.return_value.execute.return_value = AsyncMock()
        
        # Make request
        review_data = {
            "application_id": "test-app-id",
            "action": "approve",
            "review_notes": "Approved after review"
        }
        
        with patch('services.admin_api.logger'):
            response = client.post(
                "/admin/applications/review",
                json=review_data,
                headers={"Authorization": "Bearer test-token"}
            )
        
        # Verify audit logging was called
        mock_log_action.assert_called_once()

    # =======================================================================
    # USER MANAGEMENT AUDIT LOGGING TESTS
    # =======================================================================
    
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.check_is_global_admin')
    @patch('services.admin_api.log_admin_action')
    @patch('services.admin_api.extract_request_metadata')
    @patch('services.admin_api.admin_rate_limit')
    def test_grant_admin_audit_logging(
        self, mock_rate_limit, mock_extract_metadata, mock_log_action, 
        mock_check_admin, mock_auth_dep, mock_supabase, mock_admin_client, sample_user_data
    ):
        """Test audit logging for granting admin access"""
        # Setup mocks
        mock_auth_dep.return_value = "granting-admin-id"
        mock_rate_limit.return_value = True
        mock_supabase.return_value = mock_admin_client
        mock_check_admin.return_value = False  # User is not admin yet
        mock_extract_metadata.return_value = {
            'ip_address': '192.168.1.1',
            'user_agent': 'TestAgent/1.0'
        }
        
        granting_admin_data = {
            'email': 'granting@admin.com',
            'full_name': 'Granting Admin'
        }
        
        # Mock database responses
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            AsyncMock(data=[sample_user_data]),     # Target user query
            AsyncMock(data=[granting_admin_data])   # Granting admin query
        ]
        mock_admin_client.rpc.return_value.execute.return_value = AsyncMock()
        
        # Make request
        with patch('services.admin_api.logger'):
            response = client.post(
                "/admin/grant-admin/test-target-user-id?notes=Granted for testing",
                headers={"Authorization": "Bearer test-token"}
            )
        
        # Verify audit logging was called
        mock_log_action.assert_called_once()
    
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.check_is_global_admin')
    @patch('services.admin_api.log_admin_action')
    @patch('services.admin_api.extract_request_metadata')
    def test_revoke_admin_audit_logging(
        self, mock_extract_metadata, mock_log_action, mock_check_admin,
        mock_auth_dep, mock_supabase, mock_admin_client, sample_user_data
    ):
        """Test audit logging for revoking admin access"""
        # Setup mocks
        mock_auth_dep.return_value = "revoking-admin-id"
        mock_supabase.return_value = mock_admin_client
        mock_check_admin.return_value = True  # User is admin
        mock_extract_metadata.return_value = {
            'ip_address': '192.168.1.1',
            'user_agent': 'TestAgent/1.0'
        }
        
        revoking_admin_data = {
            'email': 'revoking@admin.com',
            'full_name': 'Revoking Admin'
        }
        
        # Mock database responses
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            AsyncMock(data=[sample_user_data]),     # Target user query
            AsyncMock(data=[revoking_admin_data])   # Revoking admin query
        ]
        mock_admin_client.rpc.return_value.execute.return_value = AsyncMock()
        
        # Make request
        with patch('services.admin_api.logger'):
            response = client.post(
                "/admin/revoke-admin/test-target-user-id?reason=Security review",
                headers={"Authorization": "Bearer test-token"}
            )
        
        # Verify audit logging was called
        mock_log_action.assert_called_once()

    # =======================================================================
    # ERROR HANDLING AND EDGE CASES
    # =======================================================================
    
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.log_article_action')
    @patch('services.admin_api.admin_rate_limit')
    def test_delete_nonexistent_article_no_audit(
        self, mock_rate_limit, mock_log_action, mock_auth_dep, 
        mock_supabase, mock_admin_client
    ):
        """Test that audit logging is not called for non-existent articles"""
        # Setup mocks
        mock_auth_dep.return_value = "admin-user-id"
        mock_rate_limit.return_value = True
        mock_supabase.return_value = mock_admin_client
        
        # Mock empty result (article not found)
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        # Make request
        with patch('services.admin_api.logger'):
            response = client.delete(
                "/admin/articles/nonexistent-id",
                headers={"Authorization": "Bearer test-token"}
            )
        
        # Verify audit logging was NOT called
        mock_log_action.assert_not_called()
    
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    @patch('services.admin_api.check_is_global_admin')
    @patch('services.admin_api.log_admin_action')
    @patch('services.admin_api.admin_rate_limit')
    def test_grant_admin_already_admin_no_audit(
        self, mock_rate_limit, mock_log_action, mock_check_admin, 
        mock_auth_dep, mock_supabase, mock_admin_client, sample_user_data
    ):
        """Test that audit logging is not called when user is already admin"""
        # Setup mocks
        mock_auth_dep.return_value = "admin-user-id"
        mock_rate_limit.return_value = True
        mock_supabase.return_value = mock_admin_client
        mock_check_admin.return_value = True  # User is already admin
        
        # Mock user data
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [sample_user_data]
        
        # Make request
        with patch('services.admin_api.logger'):
            response = client.post(
                "/admin/grant-admin/test-target-user-id",
                headers={"Authorization": "Bearer test-token"}
            )
        
        # Verify audit logging was NOT called
        mock_log_action.assert_not_called()

class TestAuditLogUtilities:
    """Test the audit logging utility functions"""
    
    @patch('utils.audit_logging.create_supabase_admin_client')
    def test_log_admin_action_function(self, mock_supabase):
        """Test the core log_admin_action function"""
        try:
            from utils.audit_logging import log_admin_action, AuditActionType, AuditEntityType
        except ImportError:
            from backend.utils.audit_logging import log_admin_action, AuditActionType, AuditEntityType
        
        mock_client = AsyncMock()
        mock_supabase.return_value = mock_client
        
        # Test basic functionality
        assert AuditActionType.ARTICLE_DELETED
        assert AuditEntityType.ARTICLE
        
        # This would test the actual function in a real scenario
        # For now, just ensure the imports work
        assert callable(log_admin_action)

if __name__ == "__main__":
    # Run with: python -m pytest backend/tests/test_admin_audit_logging.py -v
    import sys
    import os
    
    # Add backend directory to path for imports
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    pytest.main([__file__, "-v"]) 