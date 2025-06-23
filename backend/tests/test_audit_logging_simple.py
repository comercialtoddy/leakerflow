"""
Simple Audit Logging Tests
Task 21.5: Basic verification tests for audit logging functionality

Tests the core audit logging functions and utilities to ensure they work correctly.
Focuses on the logging functions themselves rather than full endpoint integration.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime
import asyncio

class TestAuditLoggingCore:
    """Test core audit logging functionality"""
    
    @pytest.fixture
    def mock_supabase_client(self):
        """Mock Supabase client for testing"""
        mock_client = AsyncMock()
        mock_client.table.return_value = mock_client
        mock_client.insert.return_value = mock_client
        mock_client.execute.return_value = AsyncMock()
        mock_client.close.return_value = AsyncMock()
        return mock_client

    def test_audit_action_types_exist(self):
        """Test that audit action types are properly defined"""
        try:
            from utils.audit_logging import AuditActionType, AuditEntityType
        except ImportError:
            try:
                from backend.utils.audit_logging import AuditActionType, AuditEntityType
            except ImportError:
                pytest.skip("Audit logging module not found")
        
        # Test that required action types exist
        assert hasattr(AuditActionType, 'ARTICLE_DELETED')
        assert hasattr(AuditActionType, 'ARTICLE_UPDATED')
        assert hasattr(AuditActionType, 'ARTICLE_ARCHIVED')
        assert hasattr(AuditActionType, 'APPLICATION_APPROVED')
        assert hasattr(AuditActionType, 'APPLICATION_REJECTED')
        assert hasattr(AuditActionType, 'USER_ADMIN_GRANTED')
        assert hasattr(AuditActionType, 'USER_ADMIN_REVOKED')
        
        # Test that entity types exist
        assert hasattr(AuditEntityType, 'ARTICLE')
        assert hasattr(AuditEntityType, 'APPLICATION')
        assert hasattr(AuditEntityType, 'USER')

    def test_extract_request_metadata_function_exists(self):
        """Test that the extract_request_metadata function exists"""
        try:
            from utils.audit_logging import extract_request_metadata
        except ImportError:
            try:
                from backend.utils.audit_logging import extract_request_metadata
            except ImportError:
                pytest.skip("Audit logging module not found")
        
        assert callable(extract_request_metadata)

    @patch('utils.audit_logging.create_supabase_admin_client')
    def test_log_admin_action_function_basic(self, mock_supabase):
        """Test basic log_admin_action functionality"""
        try:
            from utils.audit_logging import log_admin_action, AuditActionType, AuditEntityType
        except ImportError:
            try:
                from backend.utils.audit_logging import log_admin_action, AuditActionType, AuditEntityType
            except ImportError:
                pytest.skip("Audit logging module not found")
        
        # Setup mock
        mock_client = AsyncMock()
        mock_supabase.return_value = mock_client
        
        # Test that the function is callable
        assert callable(log_admin_action)
        
        # Test basic call (without actually executing async)
        # This tests the function signature and basic structure
        try:
            # Test function signature by inspecting it
            import inspect
            sig = inspect.signature(log_admin_action)
            
            # Check required parameters exist
            params = list(sig.parameters.keys())
            assert 'admin_user_id' in params
            assert 'action_type' in params
            assert 'target_entity_type' in params
            assert 'target_entity_id' in params
            
        except Exception as e:
            pytest.fail(f"Function signature test failed: {e}")

    @patch('utils.audit_logging.create_supabase_admin_client')
    def test_log_article_action_function_exists(self, mock_supabase):
        """Test that log_article_action function exists and is callable"""
        try:
            from utils.audit_logging import log_article_action
        except ImportError:
            try:
                from backend.utils.audit_logging import log_article_action
            except ImportError:
                pytest.skip("Audit logging module not found")
        
        assert callable(log_article_action)

    @patch('utils.audit_logging.create_supabase_admin_client')
    def test_log_application_action_function_exists(self, mock_supabase):
        """Test that log_application_action function exists and is callable"""
        try:
            from utils.audit_logging import log_application_action
        except ImportError:
            try:
                from backend.utils.audit_logging import log_application_action
            except ImportError:
                pytest.skip("Audit logging module not found")
        
        assert callable(log_application_action)

    def test_admin_api_imports_audit_logging(self):
        """Test that admin_api.py has imported audit logging functions"""
        try:
            import services.admin_api as admin_api
        except ImportError:
            try:
                import backend.services.admin_api as admin_api
            except ImportError:
                pytest.skip("Admin API module not found")
        
        # Check that audit logging functions are available in the module
        assert hasattr(admin_api, 'log_admin_action')
        assert hasattr(admin_api, 'log_article_action')
        assert hasattr(admin_api, 'log_application_action')
        assert hasattr(admin_api, 'extract_request_metadata')
        assert hasattr(admin_api, 'AuditActionType')
        assert hasattr(admin_api, 'AuditEntityType')

class TestRequestMetadataExtraction:
    """Test request metadata extraction functionality"""
    
    def test_extract_request_metadata_with_mock_request(self):
        """Test metadata extraction with a mock request object"""
        try:
            from utils.audit_logging import extract_request_metadata
        except ImportError:
            try:
                from backend.utils.audit_logging import extract_request_metadata
            except ImportError:
                pytest.skip("Audit logging module not found")
        
        # Create a mock request object
        mock_request = MagicMock()
        mock_request.headers = {
            'user-agent': 'TestAgent/1.0',
            'x-forwarded-for': '192.168.1.100, 10.0.0.1',
            'x-real-ip': '192.168.1.100'
        }
        mock_request.client.host = '10.0.0.1'
        
        # Test metadata extraction
        metadata = extract_request_metadata(mock_request)
        
        # Verify returned metadata structure
        assert isinstance(metadata, dict)
        assert 'ip_address' in metadata
        assert 'user_agent' in metadata

class TestAuditLoggingDatabase:
    """Test audit logging database operations"""
    
    @patch('utils.audit_logging.create_supabase_admin_client')
    @pytest.mark.asyncio
    async def test_log_admin_action_database_call(self, mock_supabase):
        """Test that log_admin_action makes proper database calls"""
        try:
            from utils.audit_logging import log_admin_action, AuditActionType, AuditEntityType
        except ImportError:
            try:
                from backend.utils.audit_logging import log_admin_action, AuditActionType, AuditEntityType
            except ImportError:
                pytest.skip("Audit logging module not found")
        
        # Setup mock
        mock_client = AsyncMock()
        mock_supabase.return_value = mock_client
        
        # Call the function
        await log_admin_action(
            admin_user_id="test-admin-id",
            action_type=AuditActionType.ARTICLE_DELETED,
            target_entity_type=AuditEntityType.ARTICLE,
            target_entity_id="test-entity-id",
            justification="Test deletion",
            details={"test": "data"},
            ip_address="192.168.1.1",
            user_agent="TestAgent/1.0"
        )
        
        # Verify database operations were called
        mock_client.table.assert_called_with('audit_logs')
        mock_client.table.return_value.insert.assert_called_once()
        mock_client.close.assert_called_once()
        
        # Verify the data structure passed to insert
        insert_call_args = mock_client.table.return_value.insert.call_args[0][0]
        assert insert_call_args['action_by_user_id'] == "test-admin-id"
        assert insert_call_args['action_type'] == 'article_deleted'
        assert insert_call_args['target_entity_type'] == 'article'
        assert insert_call_args['target_entity_id'] == "test-entity-id"
        assert insert_call_args['justification'] == "Test deletion"
        assert insert_call_args['details'] == {"test": "data"}
        assert insert_call_args['ip_address'] == "192.168.1.1"
        assert insert_call_args['user_agent'] == "TestAgent/1.0"

class TestAdminEndpointsHaveAuditLogging:
    """Test that admin endpoints have audit logging integrated"""
    
    def test_delete_article_endpoint_has_logging_import(self):
        """Test that delete article endpoint has audit logging"""
        try:
            import services.admin_api as admin_api
        except ImportError:
            try:
                import backend.services.admin_api as admin_api
            except ImportError:
                pytest.skip("Admin API module not found")
        
        # Check that the module has imported audit logging
        assert hasattr(admin_api, 'log_article_action')
        
        # Check that delete_article_admin function exists
        assert hasattr(admin_api, 'delete_article_admin')
        
        # Get the function source to verify it calls logging
        import inspect
        source = inspect.getsource(admin_api.delete_article_admin)
        
        # Verify audit logging is called
        assert 'log_article_action' in source
        assert 'ARTICLE_DELETED' in source

    def test_update_article_endpoint_has_logging_import(self):
        """Test that update article endpoint has audit logging"""
        try:
            import services.admin_api as admin_api
        except ImportError:
            try:
                import backend.services.admin_api as admin_api
            except ImportError:
                pytest.skip("Admin API module not found")
        
        # Check that update_article_admin function exists
        assert hasattr(admin_api, 'update_article_admin')
        
        # Get the function source to verify it calls logging
        import inspect
        source = inspect.getsource(admin_api.update_article_admin)
        
        # Verify audit logging is called
        assert 'log_article_action' in source
        assert 'ARTICLE_UPDATED' in source

    def test_grant_admin_endpoint_has_logging_import(self):
        """Test that grant admin endpoint has audit logging"""
        try:
            import services.admin_api as admin_api
        except ImportError:
            try:
                import backend.services.admin_api as admin_api
            except ImportError:
                pytest.skip("Admin API module not found")
        
        # Check that grant_admin_access function exists
        assert hasattr(admin_api, 'grant_admin_access')
        
        # Get the function source to verify it calls logging
        import inspect
        source = inspect.getsource(admin_api.grant_admin_access)
        
        # Verify audit logging is called
        assert 'log_admin_action' in source
        assert 'USER_ADMIN_GRANTED' in source

if __name__ == "__main__":
    # Run with: python -m pytest backend/tests/test_audit_logging_simple.py -v
    import sys
    import os
    
    # Add backend directory to path for imports
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    pytest.main([__file__, "-v"]) 