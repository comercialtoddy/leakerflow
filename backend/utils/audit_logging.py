"""
Admin Audit Logging Utility
Task 21.1: Design `log_admin_action` Utility Function

Provides standardized audit logging for all administrative actions
across articles, applications, and author management.
"""

import logging
from typing import Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum
from services.supabase import create_supabase_admin_client

logger = logging.getLogger(__name__)

# =======================================================================
# AUDIT ACTION TYPE ENUMS
# =======================================================================

class AuditActionType(str, Enum):
    """Standardized action types for audit logging"""
    
    # Application Management Actions
    APPLICATION_APPROVED = "application_approved"
    APPLICATION_REJECTED = "application_rejected"
    APPLICATION_UNDER_REVIEW = "application_under_review"
    APPLICATION_REQUIRES_CHANGES = "application_requires_changes"
    
    # Article Management Actions
    ARTICLE_CREATED = "article_created"
    ARTICLE_UPDATED = "article_updated"
    ARTICLE_DELETED = "article_deleted"
    ARTICLE_ARCHIVED = "article_archived"
    ARTICLE_PUBLISHED = "article_published"
    ARTICLE_UNPUBLISHED = "article_unpublished"
    ARTICLE_STATUS_CHANGED = "article_status_changed"
    ARTICLE_VISIBILITY_CHANGED = "article_visibility_changed"
    
    # Author Management Actions
    AUTHOR_STATUS_CHANGED = "author_status_changed"
    AUTHOR_SUSPENDED = "author_suspended"
    AUTHOR_ACTIVATED = "author_activated"
    AUTHOR_DELETED = "author_deleted"
    AUTHOR_WARNING_ISSUED = "author_warning_issued"
    AUTHOR_PROFILE_UPDATED = "author_profile_updated"
    
    # User Management Actions
    USER_ADMIN_GRANTED = "user_admin_granted"
    USER_ADMIN_REVOKED = "user_admin_revoked"
    USER_DELETED = "user_deleted"
    USER_SUSPENDED = "user_suspended"
    USER_ACTIVATED = "user_activated"
    
    # System Actions
    BULK_OPERATION = "bulk_operation"
    SYSTEM_MAINTENANCE = "system_maintenance"

class AuditEntityType(str, Enum):
    """Standardized entity types for audit logging"""
    
    APPLICATION = "application"
    ARTICLE = "article"
    AUTHOR = "author"
    USER = "user"
    ACCOUNT = "account"
    SYSTEM = "system"

# =======================================================================
# CORE AUDIT LOGGING FUNCTION
# =======================================================================

async def log_admin_action(
    admin_user_id: str,
    action_type: Union[AuditActionType, str],
    target_entity_type: Union[AuditEntityType, str, None] = None,
    target_entity_id: Optional[str] = None,
    justification: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    skip_admin_check: bool = False
) -> Optional[str]:
    """
    Log an administrative action to the audit_logs table.
    
    This function provides a standardized way to log all administrative actions
    across the Leaker Flow platform, ensuring consistency and completeness
    of the audit trail.
    
    Args:
        admin_user_id: UUID of the admin user performing the action
        action_type: Type of action performed (use AuditActionType enum values)
        target_entity_type: Type of entity affected (use AuditEntityType enum values)
        target_entity_id: UUID of the specific entity affected
        justification: Admin-provided reason for the action
        details: Additional structured data about the action (JSONB)
        ip_address: IP address from which the action was performed
        user_agent: User agent string from the admin session
        skip_admin_check: Skip admin verification (for system actions)
    
    Returns:
        UUID of the created audit log entry, or None if failed
    
    Examples:
        # Log application approval
        await log_admin_action(
            admin_user_id="admin-123",
            action_type=AuditActionType.APPLICATION_APPROVED,
            target_entity_type=AuditEntityType.APPLICATION,
            target_entity_id="app-456",
            justification="Excellent portfolio and experience",
            details={
                "applicant_name": "John Doe",
                "applicant_email": "john@example.com",
                "review_notes": "Great writing samples"
            }
        )
        
        # Log article deletion
        await log_admin_action(
            admin_user_id="admin-123",
            action_type=AuditActionType.ARTICLE_DELETED,
            target_entity_type=AuditEntityType.ARTICLE,
            target_entity_id="article-789",
            justification="Inappropriate content",
            details={
                "article_title": "Deleted Article",
                "author_id": "author-456",
                "deletion_reason": "Policy violation"
            }
        )
        
        # Log bulk operation
        await log_admin_action(
            admin_user_id="admin-123",
            action_type=AuditActionType.BULK_OPERATION,
            target_entity_type=AuditEntityType.ARTICLE,
            justification="Bulk archive of outdated articles",
            details={
                "operation": "bulk_archive",
                "affected_count": 15,
                "criteria": "articles older than 2 years"
            }
        )
    """
    
    try:
        # Convert enum values to strings
        action_type_str = action_type.value if isinstance(action_type, AuditActionType) else str(action_type)
        entity_type_str = target_entity_type.value if isinstance(target_entity_type, AuditEntityType) else target_entity_type
        
        # Get Supabase admin client
        admin_client = await create_supabase_admin_client()
        
        # Use the database function to create the audit log
        # The database function will handle admin verification unless skipped
        result = await admin_client.rpc('create_audit_log', {
            'p_action_type': action_type_str,
            'p_target_entity_type': entity_type_str,
            'p_target_entity_id': target_entity_id,
            'p_justification': justification,
            'p_details': details,
            'p_ip_address': ip_address,
            'p_user_agent': user_agent
        }).execute()
        
        await admin_client.close()
        
        if result.data:
            audit_log_id = result.data
            logger.info(
                f"Audit log created: {audit_log_id} - Admin {admin_user_id} performed {action_type_str} "
                f"on {entity_type_str} {target_entity_id}"
            )
            return audit_log_id
        else:
            logger.error(f"Failed to create audit log: {result}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating audit log: {str(e)}")
        logger.error(f"Action details: admin={admin_user_id}, action={action_type}, entity={target_entity_type}:{target_entity_id}")
        # Don't raise the exception - audit logging should not break the main operation
        return None

# =======================================================================
# SPECIALIZED LOGGING FUNCTIONS
# =======================================================================

async def log_application_action(
    admin_user_id: str,
    action_type: AuditActionType,
    application_id: str,
    applicant_data: Dict[str, Any],
    justification: Optional[str] = None,
    additional_details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Optional[str]:
    """
    Specialized logging function for application-related actions.
    
    Args:
        admin_user_id: UUID of the admin user
        action_type: Type of application action
        application_id: UUID of the application
        applicant_data: Information about the applicant
        justification: Admin's reason for the action
        additional_details: Any additional context
        ip_address: IP address of the admin
        user_agent: User agent string
    
    Returns:
        UUID of the audit log entry
    """
    
    # Build comprehensive details
    details = {
        "applicant_name": applicant_data.get("full_name"),
        "applicant_email": applicant_data.get("email"),
        "application_submitted_at": applicant_data.get("submitted_at"),
        "application_status": applicant_data.get("status")
    }
    
    # Add any additional details
    if additional_details:
        details.update(additional_details)
    
    return await log_admin_action(
        admin_user_id=admin_user_id,
        action_type=action_type,
        target_entity_type=AuditEntityType.APPLICATION,
        target_entity_id=application_id,
        justification=justification,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )

async def log_article_action(
    admin_user_id: str,
    action_type: AuditActionType,
    article_id: str,
    article_data: Dict[str, Any],
    justification: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Optional[str]:
    """
    Specialized logging function for article-related actions.
    
    Args:
        admin_user_id: UUID of the admin user
        action_type: Type of article action
        article_id: UUID of the article
        article_data: Current article information
        justification: Admin's reason for the action
        changes: Before/after values for updates
        ip_address: IP address of the admin
        user_agent: User agent string
    
    Returns:
        UUID of the audit log entry
    """
    
    # Build comprehensive details
    details = {
        "article_title": article_data.get("title"),
        "article_status": article_data.get("status"),
        "article_visibility": article_data.get("visibility"),
        "author_id": article_data.get("created_by_user_id"),
        "author_email": article_data.get("author_email"),
        "account_id": article_data.get("account_id")
    }
    
    # Add change tracking for updates
    if changes:
        details["changes"] = changes
    
    return await log_admin_action(
        admin_user_id=admin_user_id,
        action_type=action_type,
        target_entity_type=AuditEntityType.ARTICLE,
        target_entity_id=article_id,
        justification=justification,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )

async def log_author_action(
    admin_user_id: str,
    action_type: AuditActionType,
    author_id: str,
    author_data: Dict[str, Any],
    justification: Optional[str] = None,
    status_change: Optional[Dict[str, str]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Optional[str]:
    """
    Specialized logging function for author management actions.
    
    Args:
        admin_user_id: UUID of the admin user
        action_type: Type of author action
        author_id: UUID of the author
        author_data: Current author information
        justification: Admin's reason for the action
        status_change: Before/after status values
        ip_address: IP address of the admin
        user_agent: User agent string
    
    Returns:
        UUID of the audit log entry
    """
    
    # Build comprehensive details
    details = {
        "author_name": author_data.get("full_name"),
        "author_email": author_data.get("email"),
        "author_status": author_data.get("status"),
        "account_type": author_data.get("account_type"),
        "articles_published": author_data.get("articles_published"),
        "warnings": author_data.get("warnings"),
        "suspensions": author_data.get("suspensions")
    }
    
    # Add status change tracking
    if status_change:
        details["status_change"] = status_change
    
    return await log_admin_action(
        admin_user_id=admin_user_id,
        action_type=action_type,
        target_entity_type=AuditEntityType.AUTHOR,
        target_entity_id=author_id,
        justification=justification,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )

async def log_bulk_operation(
    admin_user_id: str,
    operation_type: str,
    entity_type: AuditEntityType,
    affected_ids: list,
    operation_details: Dict[str, Any],
    justification: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Optional[str]:
    """
    Log bulk administrative operations.
    
    Args:
        admin_user_id: UUID of the admin user
        operation_type: Type of bulk operation
        entity_type: Type of entities affected
        affected_ids: List of entity IDs affected
        operation_details: Details about the operation
        justification: Admin's reason for the bulk operation
        ip_address: IP address of the admin
        user_agent: User agent string
    
    Returns:
        UUID of the audit log entry
    """
    
    details = {
        "operation_type": operation_type,
        "affected_count": len(affected_ids),
        "affected_ids": affected_ids[:50],  # Limit to first 50 IDs to avoid huge logs
        "total_affected": len(affected_ids),
        **operation_details
    }
    
    return await log_admin_action(
        admin_user_id=admin_user_id,
        action_type=AuditActionType.BULK_OPERATION,
        target_entity_type=entity_type,
        justification=justification,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )

# =======================================================================
# UTILITY FUNCTIONS
# =======================================================================

def extract_request_metadata(request) -> Dict[str, Optional[str]]:
    """
    Extract IP address and user agent from FastAPI request.
    
    Args:
        request: FastAPI Request object
    
    Returns:
        Dictionary with ip_address and user_agent
    """
    
    try:
        # Extract IP address (handle proxy headers)
        ip_address = None
        if hasattr(request, 'headers'):
            # Check for common proxy headers
            ip_address = (
                request.headers.get('x-forwarded-for', '').split(',')[0].strip() or
                request.headers.get('x-real-ip') or
                request.headers.get('x-client-ip') or
                None
            )
        
        # Fallback to client host if available
        if not ip_address and hasattr(request, 'client') and request.client:
            ip_address = request.client.host
        
        # Extract user agent
        user_agent = None
        if hasattr(request, 'headers'):
            user_agent = request.headers.get('user-agent')
        
        return {
            'ip_address': ip_address,
            'user_agent': user_agent
        }
        
    except Exception as e:
        logger.warning(f"Failed to extract request metadata: {str(e)}")
        return {
            'ip_address': None,
            'user_agent': None
        }

async def get_audit_logs(
    admin_user_id: str,
    limit: int = 50,
    offset: int = 0,
    action_type: Optional[str] = None,
    target_entity_type: Optional[str] = None,
    target_entity_id: Optional[str] = None,
    user_id: Optional[str] = None
) -> Optional[list]:
    """
    Retrieve audit logs with filtering.
    
    Args:
        admin_user_id: UUID of the requesting admin (for verification)
        limit: Maximum number of records to return
        offset: Number of records to skip
        action_type: Filter by action type
        target_entity_type: Filter by entity type
        target_entity_id: Filter by specific entity ID
        user_id: Filter by admin user ID
    
    Returns:
        List of audit log records
    """
    
    try:
        admin_client = await create_supabase_admin_client()
        
        result = await admin_client.rpc('get_audit_logs', {
            'p_limit': limit,
            'p_offset': offset,
            'p_action_type': action_type,
            'p_target_entity_type': target_entity_type,
            'p_target_entity_id': target_entity_id,
            'p_user_id': user_id
        }).execute()
        
        await admin_client.close()
        
        return result.data
        
    except Exception as e:
        logger.error(f"Error retrieving audit logs: {str(e)}")
        return None

# =======================================================================
# VALIDATION HELPERS
# =======================================================================

def validate_audit_data(
    action_type: Union[AuditActionType, str],
    target_entity_type: Union[AuditEntityType, str, None],
    target_entity_id: Optional[str]
) -> bool:
    """
    Validate audit log data before insertion.
    
    Args:
        action_type: Type of action
        target_entity_type: Type of target entity
        target_entity_id: ID of target entity
    
    Returns:
        True if data is valid, False otherwise
    """
    
    # Action type is required
    if not action_type:
        logger.error("Action type is required for audit logging")
        return False
    
    # If entity type is provided, entity ID should also be provided
    if target_entity_type and not target_entity_id:
        logger.warning(f"Entity type '{target_entity_type}' provided without entity ID")
    
    # Validate enum values
    if isinstance(action_type, str):
        try:
            AuditActionType(action_type)
        except ValueError:
            logger.warning(f"Unknown action type: {action_type}")
    
    if isinstance(target_entity_type, str) and target_entity_type:
        try:
            AuditEntityType(target_entity_type)
        except ValueError:
            logger.warning(f"Unknown entity type: {target_entity_type}")
    
    return True 