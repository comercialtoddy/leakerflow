"""
Author Application API Router
Handles endpoints for author application submission and management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, HttpUrl, validator
from services.supabase import create_supabase_admin_client
from utils.auth_utils import get_current_user_id_from_jwt
from utils.logger import logger
from utils.rate_limiting import application_rate_limit
from services.articles_email import articles_email_service, ApplicationStatus


router = APIRouter(prefix="/author", tags=["Author Applications"])


class AuthorApplicationCreate(BaseModel):
    """Pydantic model for author application submission"""
    
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name of the applicant")
    email: str = Field(..., description="Email address of the applicant")
    bio: Optional[str] = Field(None, max_length=1000, description="Brief biography of the applicant")
    writing_experience: str = Field(..., max_length=2000, description="Description of writing experience")
    portfolio_links: Optional[List[str]] = Field(default=[], description="Portfolio URLs")
    motivation: str = Field(..., min_length=50, max_length=2000, description="Motivation for becoming an author")
    
    @validator('portfolio_links')
    def validate_portfolio_links(cls, v):
        """Validate that portfolio links are valid URLs"""
        if v is None:
            return []
        
        if len(v) > 10:
            raise ValueError('Maximum 10 portfolio links allowed')
        
        # Basic URL validation
        for link in v:
            if not link.startswith(('http://', 'https://')):
                raise ValueError(f'Invalid URL format: {link}')
        
        return v
    
    @validator('email')
    def validate_email(cls, v):
        """Basic email validation"""
        if '@' not in v or '.' not in v:
            raise ValueError('Invalid email format')
        return v.lower()


@router.post('/applications', status_code=status.HTTP_201_CREATED)
async def submit_application(
    app_data: AuthorApplicationCreate,
    user_id: str = Depends(get_current_user_id_from_jwt),
    _rate_limit: bool = Depends(application_rate_limit)
) -> Dict[str, Any]:
    """
    Submit a new author application.
    
    Users can only have one application (pending or approved) at a time.
    If an existing application is found, returns 409 Conflict.
    """
    try:
        logger.info(f"User {user_id} submitting author application")
        
        # Use admin client to interact with database
        admin_client = await create_supabase_admin_client()
        
        # Check for existing application (RF010 - Unique Application Enforcement)
        existing_app_response = await admin_client.table('author_applications').select('id, status').eq('user_id', user_id).execute()
        
        if existing_app_response.data:
            existing_status = existing_app_response.data[0]['status']
            await admin_client.close()
            
            logger.warning(f"User {user_id} attempted to submit duplicate application (existing status: {existing_status})")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Application already exists with status: {existing_status}. Please wait for review or contact support."
            )
        
        # Prepare data for insertion
        application_data = app_data.model_dump()
        application_data['user_id'] = user_id
        application_data['status'] = 'pending'  # Default status for new applications
        
        logger.debug(f"Inserting application data: {application_data}")
        
        # Insert new application using the submit_author_application function
        insert_response = await admin_client.rpc('submit_author_application', {
            'p_user_id': user_id,
            'p_full_name': application_data['full_name'],
            'p_email': application_data['email'],
            'p_bio': application_data['bio'],
            'p_writing_experience': application_data['writing_experience'],
            'p_portfolio_links': application_data['portfolio_links'] or [],
            'p_motivation': application_data['motivation']
        }).execute()
        
        # Close admin client
        await admin_client.close()
        
        if insert_response.data:
            application_id = insert_response.data
            logger.info(f"Author application submitted successfully for user {user_id}, application ID: {application_id}")
            
            # Send confirmation email to the applicant
            try:
                email_sent = articles_email_service.send_application_notification(
                    user_email=application_data['email'],
                    user_name=application_data['full_name'],
                    status=ApplicationStatus.SUBMITTED
                )
                
                if email_sent:
                    logger.info(f"Confirmation email sent to {application_data['email']} for application {application_id}")
                else:
                    logger.warning(f"Failed to send confirmation email to {application_data['email']} for application {application_id}")
                    
            except Exception as e:
                logger.error(f"Error sending confirmation email for application {application_id}: {str(e)}")
                # Don't fail the entire request if email fails
            
            return {
                'message': 'Author application submitted successfully',
                'application_id': application_id,
                'status': 'pending',
                'submitted_by': user_id,
                'email_sent': email_sent if 'email_sent' in locals() else False
            }
        else:
            logger.error(f"Failed to submit application for user {user_id}: {insert_response}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to submit application due to a server error"
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions (like 409 Conflict)
        raise
    except Exception as e:
        logger.error(f"Unexpected error submitting application for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit application due to an unexpected error"
        )


@router.get('/applications/status')
async def get_application_status(
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> Dict[str, Any]:
    """
    Get the current user's application status.
    
    Returns application details if it exists, or indicates no application found.
    """
    try:
        logger.info(f"Getting application status for user {user_id}")
        
        # Use admin client to query application status
        admin_client = await create_supabase_admin_client()
        
        # Use the get_user_application_status function
        status_response = await admin_client.rpc('get_user_application_status', {
            'p_user_id': user_id
        }).execute()
        
        # Close admin client
        await admin_client.close()
        
        if status_response.data and len(status_response.data) > 0:
            application = status_response.data[0]
            logger.info(f"Found application for user {user_id} with status: {application['status']}")
            
            return {
                'has_application': True,
                'application': application
            }
        else:
            logger.info(f"No application found for user {user_id}")
            return {
                'has_application': False,
                'message': 'No application found'
            }
            
    except Exception as e:
        logger.error(f"Error getting application status for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get application status"
        ) 