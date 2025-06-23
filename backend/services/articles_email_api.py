from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
import asyncio
from services.articles_email import articles_email_service, ApplicationStatus
from utils.logger import logger

router = APIRouter()

class SendApplicationNotificationRequest(BaseModel):
    user_email: EmailStr
    user_name: str
    status: ApplicationStatus
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None

class SendAdminNotificationRequest(BaseModel):
    admin_email: EmailStr
    admin_name: str
    applicant_name: str
    applicant_email: EmailStr
    application_id: str

class EmailResponse(BaseModel):
    success: bool
    message: str

@router.post("/send-application-notification", response_model=EmailResponse)
async def send_application_notification(request: SendApplicationNotificationRequest):
    """Send email notification to user about their application status"""
    try:
        logger.info(f"Sending application notification to {request.user_email} with status {request.status}")
        
        success = articles_email_service.send_application_notification(
            user_email=request.user_email,
            user_name=request.user_name,
            status=request.status,
            admin_notes=request.admin_notes,
            rejection_reason=request.rejection_reason
        )
        
        if success:
            return EmailResponse(
                success=True,
                message=f"Application notification ({request.status}) sent successfully"
            )
        else:
            return EmailResponse(
                success=False,
                message="Failed to send application notification"
            )
            
    except Exception as e:
        logger.error(f"Error sending application notification to {request.user_email}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while sending application notification"
        )

@router.post("/send-admin-notification", response_model=EmailResponse)
async def send_admin_notification(request: SendAdminNotificationRequest):
    """Send email notification to admin about new application"""
    try:
        logger.info(f"Sending admin notification to {request.admin_email} for application {request.application_id}")
        
        success = articles_email_service.send_admin_new_application_notification(
            admin_email=request.admin_email,
            admin_name=request.admin_name,
            applicant_name=request.applicant_name,
            applicant_email=request.applicant_email,
            application_id=request.application_id
        )
        
        if success:
            return EmailResponse(
                success=True,
                message="Admin notification sent successfully"
            )
        else:
            return EmailResponse(
                success=False,
                message="Failed to send admin notification"
            )
            
    except Exception as e:
        logger.error(f"Error sending admin notification to {request.admin_email}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while sending admin notification"
        )

@router.post("/test-email", response_model=EmailResponse)
async def test_email_service():
    """Test the email service configuration"""
    try:
        logger.info("Testing email service configuration")
        
        # Test with a simple submitted template
        success = articles_email_service.send_application_notification(
            user_email="test@example.com",
            user_name="Test User",
            status=ApplicationStatus.SUBMITTED
        )
        
        if success:
            return EmailResponse(
                success=True,
                message="Email service test successful"
            )
        else:
            return EmailResponse(
                success=False,
                message="Email service test failed - check configuration"
            )
            
    except Exception as e:
        logger.error(f"Error testing email service: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Email service test failed: {str(e)}"
        )

@router.get("/email-service-status")
async def get_email_service_status():
    """Get the current status of the email service"""
    try:
        service = articles_email_service
        
        return {
            "configured": service.client is not None,
            "client_type": service.client_type,
            "sender_email": service.sender_email,
            "sender_name": service.sender_name,
            "base_url": service.base_url,
            "resend_configured": service.resend_api_key is not None,
            "mailtrap_configured": service.mailtrap_api_key is not None
        }
        
    except Exception as e:
        logger.error(f"Error getting email service status: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error retrieving email service status"
        ) 