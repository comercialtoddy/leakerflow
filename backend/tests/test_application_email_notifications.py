"""
Test Application Email Notifications
Task 12: Implementation of automated email notifications for application status changes
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from backend.api import app
from services.articles_email import ApplicationStatus

# Test client
client = TestClient(app)

class TestApplicationSubmissionEmailNotification:
    """Test email notifications for application submission"""
    
    @patch('services.author.application_router.articles_email_service')
    @patch('services.author.application_router.create_supabase_admin_client')
    @patch('services.author.application_router.get_current_user_id_from_jwt')
    def test_submission_confirmation_email_success(
        self, 
        mock_get_user_id, 
        mock_supabase, 
        mock_email_service
    ):
        """Test successful email notification on application submission"""
        # Mock user authentication
        mock_get_user_id.return_value = "user-123"
        
        # Mock Supabase client
        mock_client = AsyncMock()
        mock_supabase.return_value = mock_client
        
        # Mock no existing application
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = AsyncMock(data=[])
        
        # Mock successful application insertion
        mock_client.rpc.return_value.execute.return_value = AsyncMock(data="app-456")
        
        # Mock email service
        mock_email_service.send_application_notification.return_value = True
        
        # Test data
        application_data = {
            "full_name": "John Doe",
            "email": "john.doe@example.com",
            "bio": "Experienced writer",
            "writing_experience": "5 years of technical writing experience",
            "portfolio_links": ["https://johndoe.com"],
            "motivation": "I want to share my knowledge and help others learn about technology trends."
        }
        
        # Make request
        response = client.post("/author/applications", json=application_data)
        
        # Assertions
        assert response.status_code == 201
        response_data = response.json()
        assert response_data["message"] == "Author application submitted successfully"
        assert response_data["application_id"] == "app-456"
        assert response_data["status"] == "pending"
        assert response_data["email_sent"] == True
        
        # Verify email service was called correctly
        mock_email_service.send_application_notification.assert_called_once_with(
            user_email="john.doe@example.com",
            user_name="John Doe",
            status=ApplicationStatus.SUBMITTED
        )
    
    @patch('services.author.application_router.articles_email_service')
    @patch('services.author.application_router.create_supabase_admin_client')
    @patch('services.author.application_router.get_current_user_id_from_jwt')
    def test_submission_email_failure_does_not_fail_request(
        self, 
        mock_get_user_id, 
        mock_supabase, 
        mock_email_service
    ):
        """Test that email failure doesn't fail the application submission"""
        # Mock user authentication
        mock_get_user_id.return_value = "user-123"
        
        # Mock Supabase client
        mock_client = AsyncMock()
        mock_supabase.return_value = mock_client
        
        # Mock no existing application
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = AsyncMock(data=[])
        
        # Mock successful application insertion
        mock_client.rpc.return_value.execute.return_value = AsyncMock(data="app-456")
        
        # Mock email service failure
        mock_email_service.send_application_notification.return_value = False
        
        # Test data
        application_data = {
            "full_name": "Jane Smith",
            "email": "jane.smith@example.com",
            "bio": "Tech enthusiast",
            "writing_experience": "3 years of blogging experience",
            "portfolio_links": ["https://janesmith.blog"],
            "motivation": "I want to contribute to the tech community by sharing insights and tutorials."
        }
        
        # Make request
        response = client.post("/author/applications", json=application_data)
        
        # Assertions - request should still succeed
        assert response.status_code == 201
        response_data = response.json()
        assert response_data["message"] == "Author application submitted successfully"
        assert response_data["application_id"] == "app-456"
        assert response_data["email_sent"] == False
        
        # Verify email service was called
        mock_email_service.send_application_notification.assert_called_once()


class TestAdminApprovalEmailNotification:
    """Test email notifications for admin application approval"""
    
    @patch('services.admin_api.articles_email_service')
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    def test_approval_email_notification(
        self, 
        mock_require_admin, 
        mock_supabase, 
        mock_email_service
    ):
        """Test email notification on application approval"""
        # Mock admin authentication
        mock_require_admin.return_value = "admin-123"
        
        # Mock Supabase client
        mock_client = AsyncMock()
        mock_supabase.return_value = mock_client
        
        # Mock application data
        mock_application = {
            'id': 'app-456',
            'full_name': 'John Doe',
            'email': 'john.doe@example.com',
            'status': 'pending',
            'submitted_at': '2024-01-15T10:00:00Z'
        }
        
        # Mock application retrieval
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = AsyncMock(
            data=[mock_application]
        )
        
        # Mock update success
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = AsyncMock(
            data=[{**mock_application, 'status': 'approved'}]
        )
        
        # Mock audit log insertion
        mock_client.table.return_value.insert.return_value.execute.return_value = AsyncMock(data=[{}])
        
        # Mock email service
        mock_email_service.send_application_notification.return_value = True
        
        # Test approval request
        approval_data = {
            "review_notes": "Great portfolio and experience. Welcome to the team!"
        }
        
        response = client.post("/admin/applications/app-456/approve", json=approval_data)
        
        # Assertions
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["message"] == "Application approved successfully"
        assert response_data["application_id"] == "app-456"
        assert response_data["email_sent"] == True
        
        # Verify email service was called correctly
        mock_email_service.send_application_notification.assert_called_once_with(
            user_email="john.doe@example.com",
            user_name="John Doe",
            status=ApplicationStatus.APPROVED,
            admin_notes="Great portfolio and experience. Welcome to the team!"
        )


class TestAdminRejectionEmailNotification:
    """Test email notifications for admin application rejection"""
    
    @patch('services.admin_api.articles_email_service')
    @patch('services.admin_api.create_supabase_admin_client')
    @patch('services.admin_api.require_global_admin')
    def test_rejection_email_notification(
        self, 
        mock_require_admin, 
        mock_supabase, 
        mock_email_service
    ):
        """Test email notification on application rejection"""
        # Mock admin authentication
        mock_require_admin.return_value = "admin-123"
        
        # Mock Supabase client
        mock_client = AsyncMock()
        mock_supabase.return_value = mock_client
        
        # Mock application data
        mock_application = {
            'id': 'app-789',
            'full_name': 'Jane Smith',
            'email': 'jane.smith@example.com',
            'status': 'pending',
            'submitted_at': '2024-01-20T14:30:00Z'
        }
        
        # Mock application retrieval
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = AsyncMock(
            data=[mock_application]
        )
        
        # Mock update success
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = AsyncMock(
            data=[{**mock_application, 'status': 'rejected'}]
        )
        
        # Mock audit log insertion
        mock_client.table.return_value.insert.return_value.execute.return_value = AsyncMock(data=[{}])
        
        # Mock email service
        mock_email_service.send_application_notification.return_value = True
        
        # Test rejection request
        rejection_data = {
            "review_notes": "Thank you for your application. We need more experience in the requested areas.",
            "rejection_reason": "Insufficient technical writing experience"
        }
        
        response = client.post("/admin/applications/app-789/reject", json=rejection_data)
        
        # Assertions
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["message"] == "Application rejected successfully"
        assert response_data["application_id"] == "app-789"
        assert response_data["email_sent"] == True
        
        # Verify email service was called correctly
        mock_email_service.send_application_notification.assert_called_once_with(
            user_email="jane.smith@example.com",
            user_name="Jane Smith",
            status=ApplicationStatus.REJECTED,
            admin_notes="Thank you for your application. We need more experience in the requested areas.",
            rejection_reason="Insufficient technical writing experience"
        )


class TestEmailTemplateContent:
    """Test email template content and structure"""
    
    def test_submission_confirmation_template(self):
        """Test submission confirmation email template"""
        from services.articles_email import articles_email_service
        
        template = articles_email_service._get_submitted_template("John Doe")
        
        # Check subject
        assert "Application Has Been Received" in template.subject
        assert "Leaker Flow" in template.subject
        
        # Check HTML content
        assert "John Doe" in template.html_content
        assert "2-3 business days" in template.html_content
        assert "leakerflow.com/applications" in template.html_content
        
        # Check text content
        assert "John Doe" in template.text_content
        assert "2-3 business days" in template.text_content
        assert "leakerflow.com/applications" in template.text_content
    
    def test_approval_template(self):
        """Test approval email template"""
        from services.articles_email import articles_email_service
        
        template = articles_email_service._get_approved_template("Jane Smith")
        
        # Check subject
        assert "Congratulations" in template.subject
        assert "Approved" in template.subject
        
        # Check HTML content
        assert "Jane Smith" in template.html_content
        assert "Welcome to the Leaker Flow authors community" in template.html_content
        assert "Articles Dashboard" in template.html_content
        assert "Start Writing!" in template.html_content
        
        # Check text content
        assert "Jane Smith" in template.text_content
        assert "Welcome to the Leaker Flow authors community" in template.text_content
    
    def test_rejection_template(self):
        """Test rejection email template"""
        from services.articles_email import articles_email_service
        
        rejection_reason = "Insufficient experience in the requested areas"
        template = articles_email_service._get_rejected_template("Bob Johnson", rejection_reason)
        
        # Check subject
        assert "Update on Your Author Application" in template.subject
        
        # Check HTML content
        assert "Bob Johnson" in template.html_content
        assert rejection_reason in template.html_content
        assert "reapplying in the future" in template.html_content
        
        # Check text content
        assert "Bob Johnson" in template.text_content
        assert rejection_reason in template.text_content


class TestEmailServiceIntegration:
    """Test email service integration and error handling"""
    
    @patch('services.articles_email.resend')
    def test_resend_email_integration(self, mock_resend):
        """Test Resend email service integration"""
        from services.articles_email import ArticlesEmailService
        
        # Mock Resend success response
        mock_resend.emails.send.return_value = {"id": "email-123", "status": "sent"}
        
        # Create service instance
        service = ArticlesEmailService()
        service.resend_api_key = "test-key"
        service.client = mock_resend
        service.client_type = 'resend'
        
        # Test email sending
        result = service.send_application_notification(
            user_email="test@example.com",
            user_name="Test User",
            status=ApplicationStatus.SUBMITTED
        )
        
        assert result == True
        mock_resend.emails.send.assert_called_once()
    
    @patch('services.articles_email.logger')
    def test_email_service_error_handling(self, mock_logger):
        """Test email service error handling"""
        from services.articles_email import ArticlesEmailService
        
        # Create service without email client
        service = ArticlesEmailService()
        service.client = None
        
        # Test email sending without client
        result = service.send_application_notification(
            user_email="test@example.com",
            user_name="Test User",
            status=ApplicationStatus.SUBMITTED
        )
        
        assert result == False
        mock_logger.error.assert_called_with("Cannot send email: No email service configured")


class TestRateLimitingIntegration:
    """Test rate limiting integration with email endpoints"""
    
    @patch('utils.rate_limiting.get_rate_limiter')
    @patch('services.author.application_router.create_supabase_admin_client')
    @patch('services.author.application_router.get_current_user_id_from_jwt')
    def test_application_submission_rate_limiting(
        self, 
        mock_get_user_id, 
        mock_supabase,
        mock_get_rate_limiter
    ):
        """Test that application submission has rate limiting applied"""
        # Mock rate limiter to reject request
        mock_limiter = AsyncMock()
        mock_limiter.check_rate_limit.return_value = {
            'exceeded': True,
            'retry_after': 3600  # 1 hour
        }
        mock_get_rate_limiter.return_value = mock_limiter
        
        # Mock user authentication
        mock_get_user_id.return_value = "user-123"
        
        application_data = {
            "full_name": "Rate Limited User",
            "email": "ratelimited@example.com",
            "writing_experience": "Some experience",
            "motivation": "Test rate limiting functionality"
        }
        
        # This should be blocked by rate limiting
        response = client.post("/author/applications", json=application_data)
        
        # Should return 429 rate limit exceeded
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.json()["detail"]["error"] 