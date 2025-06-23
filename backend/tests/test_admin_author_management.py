"""
Tests for Admin Author Management API endpoints
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from fastapi import FastAPI

# Mock the require_global_admin dependency for testing
def mock_require_global_admin():
    return "test-admin-user-id"

class TestAdminAuthorManagementAPI:
    """Test suite for admin author management endpoints"""
    
    @pytest.fixture
    def client(self):
        """Create test client with mocked admin auth"""
        from services.admin_api import router
        from utils.auth_utils import require_global_admin
        
        app = FastAPI()
        app.include_router(router, prefix="/api")
        
        # Override the dependency
        app.dependency_overrides[require_global_admin] = mock_require_global_admin
        
        return TestClient(app)

    @pytest.fixture
    def mock_authors_data(self):
        """Mock author data for testing"""
        return [
            {
                'user_id': 'author-1',
                'full_name': 'Sarah Chen',
                'email': 'sarah.chen@techwriter.com',
                'registration_date': '2024-01-15T10:00:00Z',
                'bio': 'Experienced technology journalist',
                'status': 'active',
                'account_type': 'verified',
                'warnings': 0,
                'suspensions': 0,
                'suspension_reason': None,
                'social_media': {'twitter': '@sarahchen_tech'},
                'articles_published': 42,
                'total_views': 125420,
                'total_votes': 3856,
                'average_votes_per_article': 91.8,
                'last_published_date': '2024-12-18T15:30:00Z',
                'last_active_date': '2024-12-20T09:15:00Z'
            },
            {
                'user_id': 'author-2',
                'full_name': 'Marcus Rodriguez',
                'email': 'marcus.r@techblog.com',
                'registration_date': '2024-02-03T14:22:00Z',
                'bio': 'Senior technology correspondent',
                'status': 'active',
                'account_type': 'premium',
                'warnings': 1,
                'suspensions': 0,
                'suspension_reason': None,
                'social_media': {'twitter': '@marcus_tech_news'},
                'articles_published': 38,
                'total_views': 98340,
                'total_votes': 2947,
                'average_votes_per_article': 77.6,
                'last_published_date': '2024-12-15T11:45:00Z',
                'last_active_date': '2024-12-19T16:30:00Z'
            },
            {
                'user_id': 'author-3',
                'full_name': 'Elena Kowalski',
                'email': 'elena.k@newsnetwork.com',
                'registration_date': '2024-01-20T08:30:00Z',
                'bio': 'Freelance technology writer',
                'status': 'suspended',
                'account_type': 'basic',
                'warnings': 3,
                'suspensions': 1,
                'suspension_reason': 'Multiple policy violations regarding article accuracy',
                'social_media': {'twitter': '@elena_cybertech'},
                'articles_published': 29,
                'total_views': 76530,
                'total_votes': 2134,
                'average_votes_per_article': 73.6,
                'last_published_date': '2024-12-08T13:20:00Z',
                'last_active_date': '2024-12-10T10:15:00Z'
            }
        ]

    @pytest.fixture
    def mock_activity_data(self):
        """Mock activity history data for testing"""
        return [
            {
                'id': 'article_123_created',
                'activity_type': 'article_created',
                'target_entity_type': 'article',
                'target_entity_id': '123',
                'details': {
                    'title': 'AI Revolution in 2024',
                    'status': 'published',
                    'visibility': 'public'
                },
                'timestamp': '2024-12-20T10:30:00Z',
                'ip_address': '192.168.1.100',
                'user_agent': 'Mozilla/5.0...'
            },
            {
                'id': 'event_456',
                'activity_type': 'view',
                'target_entity_type': 'article',
                'target_entity_id': '123',
                'details': {'read_time': 180},
                'timestamp': '2024-12-20T10:45:00Z',
                'ip_address': '192.168.1.100',
                'user_agent': 'Mozilla/5.0...'
            },
            {
                'id': 'audit_789',
                'activity_type': 'author_status_change',
                'target_entity_type': 'author',
                'target_entity_id': 'author-1',
                'details': {
                    'previous_status': 'suspended',
                    'new_status': 'active'
                },
                'timestamp': '2024-12-19T14:20:00Z',
                'ip_address': '10.0.0.1',
                'user_agent': 'Admin Dashboard'
            }
        ]

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_get_all_authors_success(self, mock_client, client):
        """Test successful retrieval of all authors"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock the complex query fallback
        mock_admin_client.rpc.return_value.execute.return_value.data = None
        
        # Mock profiles query
        mock_admin_client.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.data = [
            {
                'id': 'author-1',
                'full_name': 'Sarah Chen',
                'email': 'sarah.chen@techwriter.com',
                'created_at': '2024-01-15T10:00:00Z',
                'bio': 'Experienced technology journalist',
                'metadata': {
                    'status': 'active',
                    'account_type': 'verified',
                    'warnings': 0,
                    'suspensions': 0,
                    'social_media': {'twitter': '@sarahchen_tech'}
                }
            }
        ]
        
        # Mock articles query
        mock_admin_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {
                'id': 'article-1',
                'total_views': 125420,
                'vote_score': 92,
                'created_at': '2024-12-18T15:30:00Z'
            }
        ]
        
        response = client.get("/api/admin/authors")
        
        assert response.status_code == 200
        authors = response.json()
        assert isinstance(authors, list)
        assert len(authors) == 1
        
        author = authors[0]
        assert author['id'] == 'author-1'
        assert author['full_name'] == 'Sarah Chen'
        assert author['email'] == 'sarah.chen@techwriter.com'
        assert author['status'] == 'active'
        assert author['account_type'] == 'verified'
        assert author['articles_published'] == 1
        assert author['total_views'] == 125420

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_get_all_authors_with_filters(self, mock_client, client):
        """Test authors retrieval with status and search filters"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock the complex query fallback
        mock_admin_client.rpc.return_value.execute.return_value.data = None
        mock_admin_client.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.data = []
        
        response = client.get("/api/admin/authors?status=active&search=Sarah&skip=0&limit=10")
        
        assert response.status_code == 200
        mock_client.assert_called_once()

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_get_all_authors_error_handling(self, mock_client, client):
        """Test error handling in get all authors endpoint"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock database error
        mock_admin_client.rpc.side_effect = Exception("Database connection failed")
        
        response = client.get("/api/admin/authors")
        
        assert response.status_code == 500
        assert response.json()['detail'] == "Failed to retrieve authors"

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_update_author_status_success_suspend(self, mock_client, client):
        """Test successful author status update to suspended"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock author exists
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                'id': 'author-1',
                'full_name': 'Sarah Chen',
                'email': 'sarah.chen@techwriter.com',
                'metadata': {
                    'status': 'active',
                    'warnings': 0,
                    'suspensions': 0
                }
            }
        ]
        
        # Mock successful update
        mock_admin_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            {'id': 'author-1'}
        ]
        
        # Mock audit log insertion
        mock_admin_client.table.return_value.insert.return_value.execute.return_value = AsyncMock()
        
        response = client.put("/api/admin/authors/author-1/status", json={
            "status": "suspended",
            "reason": "Violation of community guidelines"
        })
        
        assert response.status_code == 200
        result = response.json()
        assert result['message'] == "Author status updated to suspended"
        assert result['author_id'] == 'author-1'
        assert result['previous_status'] == 'active'
        assert result['new_status'] == 'suspended'

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_update_author_status_success_reactivate(self, mock_client, client):
        """Test successful author status update to active (reactivation)"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock suspended author
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                'id': 'author-3',
                'full_name': 'Elena Kowalski',
                'email': 'elena.k@newsnetwork.com',
                'metadata': {
                    'status': 'suspended',
                    'warnings': 3,
                    'suspensions': 1,
                    'suspension_reason': 'Policy violations'
                }
            }
        ]
        
        # Mock successful update
        mock_admin_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            {'id': 'author-3'}
        ]
        
        # Mock audit log insertion
        mock_admin_client.table.return_value.insert.return_value.execute.return_value = AsyncMock()
        
        response = client.put("/api/admin/authors/author-3/status", json={
            "status": "active",
            "reason": "Appeal approved, warnings addressed"
        })
        
        assert response.status_code == 200
        result = response.json()
        assert result['new_status'] == 'active'
        assert result['previous_status'] == 'suspended'

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_update_author_status_invalid_status(self, mock_client, client):
        """Test author status update with invalid status"""
        response = client.put("/api/admin/authors/author-1/status", json={
            "status": "banned",  # Invalid status
            "reason": "Test reason"
        })
        
        assert response.status_code == 400
        assert "Invalid status" in response.json()['detail']

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_update_author_status_author_not_found(self, mock_client, client):
        """Test author status update for non-existent author"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock author not found
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        response = client.put("/api/admin/authors/non-existent/status", json={
            "status": "suspended",
            "reason": "Test reason"
        })
        
        assert response.status_code == 404
        assert response.json()['detail'] == "Author not found"

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_update_author_status_database_error(self, mock_client, client):
        """Test error handling in author status update"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock database error
        mock_admin_client.table.return_value.select.side_effect = Exception("Database error")
        
        response = client.put("/api/admin/authors/author-1/status", json={
            "status": "suspended",
            "reason": "Test reason"
        })
        
        assert response.status_code == 500
        assert response.json()['detail'] == "Failed to update author status"

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_get_author_activity_history_success(self, mock_client, client):
        """Test successful retrieval of author activity history"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock author exists
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                'id': 'author-1',
                'full_name': 'Sarah Chen',
                'email': 'sarah.chen@techwriter.com'
            }
        ]
        
        # Mock articles query with proper return structure
        articles_mock = AsyncMock()
        articles_mock.execute.return_value.data = [
            {
                'id': 'article-123',
                'title': 'AI Revolution',
                'status': 'published',
                'created_at': '2024-12-20T10:30:00Z',
                'updated_at': '2024-12-20T10:30:00Z',
                'visibility': 'public'
            }
        ]
        
        # Mock events and audit queries
        events_mock = AsyncMock()
        events_mock.execute.return_value.data = []
        
        audit_mock = AsyncMock()
        audit_mock.execute.return_value.data = []
        
        # Set up the mock chain properly
        def mock_table_chain(*args, **kwargs):
            chain_mock = AsyncMock()
            chain_mock.select.return_value.eq.return_value.order.return_value = articles_mock
            return chain_mock
        
        mock_admin_client.table.side_effect = mock_table_chain
        
        response = client.get("/api/admin/authors/author-1/activity-history")
        
        assert response.status_code == 200
        activities = response.json()
        assert isinstance(activities, list)

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_get_author_activity_history_with_filters(self, mock_client, client):
        """Test author activity history with type filter"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock author exists
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {'id': 'author-1', 'full_name': 'Sarah Chen', 'email': 'sarah.chen@techwriter.com'}
        ]
        
        # Mock empty results for all queries
        mock_query = AsyncMock()
        mock_query.execute.return_value.data = []
        mock_admin_client.table.return_value.select.return_value.eq.return_value.order.return_value = mock_query
        
        response = client.get("/api/admin/authors/author-1/activity-history?activity_type=article&skip=0&limit=25")
        
        assert response.status_code == 200
        activities = response.json()
        assert isinstance(activities, list)

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_get_author_activity_history_author_not_found(self, mock_client, client):
        """Test activity history for non-existent author"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock author not found
        mock_admin_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        response = client.get("/api/admin/authors/non-existent/activity-history")
        
        assert response.status_code == 404
        assert response.json()['detail'] == "Author not found"

    @patch('services.admin_api.create_supabase_admin_client')
    async def test_get_author_activity_history_error_handling(self, mock_client, client):
        """Test error handling in activity history endpoint"""
        mock_admin_client = AsyncMock()
        mock_client.return_value = mock_admin_client
        
        # Mock database error
        mock_admin_client.table.return_value.select.side_effect = Exception("Database connection failed")
        
        response = client.get("/api/admin/authors/author-1/activity-history")
        
        assert response.status_code == 500
        assert response.json()['detail'] == "Failed to retrieve author activity history"

    def test_unauthorized_access_all_endpoints(self, client):
        """Test that all endpoints require admin authentication"""
        # Override to remove admin auth
        app = client.app
        app.dependency_overrides.clear()
        
        # Test all endpoints without auth
        endpoints = [
            ("GET", "/api/admin/authors"),
            ("PUT", "/api/admin/authors/test-id/status"),
            ("GET", "/api/admin/authors/test-id/activity-history")
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "PUT":
                response = client.put(endpoint, json={"status": "active"})
            
            # Should fail due to missing admin auth
            assert response.status_code in [401, 422]  # Depends on FastAPI dependency handling

if __name__ == "__main__":
    pytest.main([__file__]) 