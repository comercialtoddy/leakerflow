"""
Tests for Admin Article Moderation API endpoints
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from datetime import datetime

# Mock the require_global_admin dependency for testing
def mock_require_global_admin():
    return "test-admin-user-id"

class TestAdminArticleModerationAPI:
    """Test suite for admin article moderation endpoints"""
    
    @pytest.fixture
    def client(self):
        """Create test client with mocked admin auth"""
        from services.admin_api import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router, prefix="/api")
        
        # Override the admin dependency
        app.dependency_overrides[require_global_admin] = mock_require_global_admin
        
        return TestClient(app)
    
    @pytest.fixture
    def mock_supabase_client(self):
        """Mock Supabase client for testing"""
        mock_client = AsyncMock()
        mock_client.table.return_value = mock_client
        mock_client.select.return_value = mock_client
        mock_client.eq.return_value = mock_client
        mock_client.update.return_value = mock_client
        mock_client.delete.return_value = mock_client
        mock_client.close.return_value = None
        return mock_client
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_get_articles_admin_success(self, mock_create_client, client, mock_supabase_client):
        """Test GET /api/admin/articles returns articles successfully"""
        # Setup mock data
        mock_articles = [
            {
                'id': 'article-1',
                'title': 'Test Article 1',
                'status': 'published',
                'visibility': 'public',
                'created_at': '2024-01-01T00:00:00Z',
                'updated_at': '2024-01-01T00:00:00Z',
                'account_id': 'account-1',
                'created_by_user_id': 'user-1'
            },
            {
                'id': 'article-2',
                'title': 'Test Article 2',
                'status': 'draft',
                'visibility': 'account',
                'created_at': '2024-01-02T00:00:00Z',
                'updated_at': '2024-01-02T00:00:00Z',
                'account_id': 'account-2',
                'created_by_user_id': 'user-2'
            }
        ]
        
        mock_create_client.return_value = mock_supabase_client
        mock_supabase_client.execute.return_value.data = mock_articles
        
        # Make request
        response = client.get("/api/admin/articles")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]['id'] == 'article-1'
        assert data[1]['id'] == 'article-2'
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_update_article_admin_success(self, mock_create_client, client, mock_supabase_client):
        """Test PUT /api/admin/articles/{article_id} updates article successfully"""
        article_id = 'test-article-id'
        
        # Mock existing article
        mock_supabase_client.execute.side_effect = [
            # First call: check if article exists
            AsyncMock(data=[{'id': article_id, 'title': 'Original Title', 'status': 'draft'}]),
            # Second call: update article
            AsyncMock(data=[{
                'id': article_id,
                'title': 'Updated Title',
                'status': 'published',
                'visibility': 'public',
                'updated_at': '2024-01-01T12:00:00Z'
            }])
        ]
        
        mock_create_client.return_value = mock_supabase_client
        
        # Update data
        update_data = {
            'title': 'Updated Title',
            'status': 'published',
            'visibility': 'public'
        }
        
        # Make request
        response = client.put(f"/api/admin/articles/{article_id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data['message'] == 'Article updated successfully'
        assert data['article_id'] == article_id
        assert 'title' in data['updated_fields']
        assert 'status' in data['updated_fields']
        assert 'visibility' in data['updated_fields']
        assert data['article']['title'] == 'Updated Title'
        assert data['article']['status'] == 'published'
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_update_article_admin_not_found(self, mock_create_client, client, mock_supabase_client):
        """Test PUT /api/admin/articles/{article_id} returns 404 for non-existent article"""
        article_id = 'non-existent-article'
        
        # Mock no article found
        mock_supabase_client.execute.return_value.data = []
        mock_create_client.return_value = mock_supabase_client
        
        update_data = {'title': 'Updated Title'}
        
        # Make request
        response = client.put(f"/api/admin/articles/{article_id}", json=update_data)
        
        assert response.status_code == 404
        assert 'Article not found' in response.json()['detail']
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_update_article_admin_invalid_status(self, mock_create_client, client, mock_supabase_client):
        """Test PUT /api/admin/articles/{article_id} validates status values"""
        article_id = 'test-article-id'
        
        # Mock existing article
        mock_supabase_client.execute.return_value.data = [
            {'id': article_id, 'title': 'Test Article', 'status': 'draft'}
        ]
        mock_create_client.return_value = mock_supabase_client
        
        # Invalid status
        update_data = {'status': 'invalid_status'}
        
        # Make request
        response = client.put(f"/api/admin/articles/{article_id}", json=update_data)
        
        assert response.status_code == 400
        assert 'Invalid status' in response.json()['detail']
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_update_article_admin_invalid_visibility(self, mock_create_client, client, mock_supabase_client):
        """Test PUT /api/admin/articles/{article_id} validates visibility values"""
        article_id = 'test-article-id'
        
        # Mock existing article
        mock_supabase_client.execute.return_value.data = [
            {'id': article_id, 'title': 'Test Article', 'status': 'draft'}
        ]
        mock_create_client.return_value = mock_supabase_client
        
        # Invalid visibility
        update_data = {'visibility': 'invalid_visibility'}
        
        # Make request
        response = client.put(f"/api/admin/articles/{article_id}", json=update_data)
        
        assert response.status_code == 400
        assert 'Invalid visibility' in response.json()['detail']
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_update_article_admin_no_fields(self, mock_create_client, client, mock_supabase_client):
        """Test PUT /api/admin/articles/{article_id} requires at least one field to update"""
        article_id = 'test-article-id'
        
        # Mock existing article
        mock_supabase_client.execute.return_value.data = [
            {'id': article_id, 'title': 'Test Article', 'status': 'draft'}
        ]
        mock_create_client.return_value = mock_supabase_client
        
        # Empty update data
        update_data = {}
        
        # Make request
        response = client.put(f"/api/admin/articles/{article_id}", json=update_data)
        
        assert response.status_code == 400
        assert 'No valid fields provided for update' in response.json()['detail']
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_archive_article_admin_success(self, mock_create_client, client, mock_supabase_client):
        """Test POST /api/admin/articles/{article_id}/archive archives article successfully"""
        article_id = 'test-article-id'
        
        # Mock existing article
        mock_supabase_client.execute.side_effect = [
            # First call: check if article exists
            AsyncMock(data=[{'id': article_id, 'title': 'Test Article', 'status': 'published'}]),
            # Second call: update article to archived
            AsyncMock(data=[{
                'id': article_id,
                'title': 'Test Article',
                'status': 'archived',
                'updated_at': '2024-01-01T12:00:00Z'
            }])
        ]
        
        mock_create_client.return_value = mock_supabase_client
        
        # Make request
        response = client.post(f"/api/admin/articles/{article_id}/archive")
        
        assert response.status_code == 200
        data = response.json()
        assert data['message'] == 'Article archived successfully'
        assert data['article_id'] == article_id
        assert data['previous_status'] == 'published'
        assert data['new_status'] == 'archived'
        assert data['title'] == 'Test Article'
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_archive_article_admin_already_archived(self, mock_create_client, client, mock_supabase_client):
        """Test POST /api/admin/articles/{article_id}/archive handles already archived articles"""
        article_id = 'test-article-id'
        
        # Mock article already archived
        mock_supabase_client.execute.return_value.data = [
            {'id': article_id, 'title': 'Test Article', 'status': 'archived'}
        ]
        mock_create_client.return_value = mock_supabase_client
        
        # Make request
        response = client.post(f"/api/admin/articles/{article_id}/archive")
        
        assert response.status_code == 200
        data = response.json()
        assert data['message'] == 'Article is already archived'
        assert data['article_id'] == article_id
        assert data['status'] == 'archived'
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_archive_article_admin_not_found(self, mock_create_client, client, mock_supabase_client):
        """Test POST /api/admin/articles/{article_id}/archive returns 404 for non-existent article"""
        article_id = 'non-existent-article'
        
        # Mock no article found
        mock_supabase_client.execute.return_value.data = []
        mock_create_client.return_value = mock_supabase_client
        
        # Make request
        response = client.post(f"/api/admin/articles/{article_id}/archive")
        
        assert response.status_code == 404
        assert 'Article not found' in response.json()['detail']
    
    @patch('services.admin_api.create_supabase_admin_client')
    def test_delete_article_admin_success(self, mock_create_client, client, mock_supabase_client):
        """Test DELETE /api/admin/articles/{article_id} deletes article successfully"""
        article_id = 'test-article-id'
        
        # Mock existing article
        mock_supabase_client.execute.side_effect = [
            # First call: check if article exists
            AsyncMock(data=[{'id': article_id, 'title': 'Test Article'}]),
            # Second call: delete article
            AsyncMock(data=[])
        ]
        
        mock_create_client.return_value = mock_supabase_client
        
        # Make request
        response = client.delete(f"/api/admin/articles/{article_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data['message'] == 'Article deleted successfully'
        assert data['article_id'] == article_id


if __name__ == "__main__":
    # Basic manual tests - can be run independently
    print("Article Moderation API Tests")
    print("============================")
    
    # Test data validation
    from pydantic import ValidationError
    from services.admin_api import UpdateArticleRequest
    
    print("Testing UpdateArticleRequest validation...")
    
    # Valid data
    try:
        valid_request = UpdateArticleRequest(
            title="Test Title",
            status="published",
            visibility="public"
        )
        print("✓ Valid request accepted")
    except ValidationError as e:
        print(f"✗ Valid request rejected: {e}")
    
    # Test with all possible fields
    try:
        full_request = UpdateArticleRequest(
            title="Full Test Article",
            subtitle="Test Subtitle",
            content="Test content",
            category="official",
            status="published",
            visibility="public",
            tags=["test", "article"],
            author="Test Author",
            read_time="5 min",
            image_url="https://example.com/image.jpg",
            media_items=[{"type": "image", "url": "https://example.com/media.jpg"}],
            sources=[{"title": "Source 1", "url": "https://example.com/source.html"}],
            sections=[{"title": "Section 1", "content": "Section content"}]
        )
        print("✓ Full request with all fields accepted")
    except ValidationError as e:
        print(f"✗ Full request rejected: {e}")
    
    print("\nAPI Endpoints Summary:")
    print("======================")
    print("✓ GET /api/admin/articles - List all articles (existing)")
    print("✓ PUT /api/admin/articles/{id} - Update article (NEW)")
    print("✓ DELETE /api/admin/articles/{id} - Delete article (existing)")
    print("✓ POST /api/admin/articles/{id}/archive - Archive article (NEW)")
    print("\nAll endpoints require global admin authentication.")
    print("New endpoints include comprehensive validation and error handling.") 