import os
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class ApplicationStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_CHANGES = "requires_changes"

@dataclass
class EmailTemplate:
    subject: str
    html_content: str
    text_content: str

class ArticlesEmailService:
    """
    Email service specifically for the Articles Dashboard and Author Applications system.
    Supports both Resend and Mailtrap based on configuration.
    """
    
    def __init__(self):
        # Try Resend first (recommended by task), fallback to Mailtrap
        self.resend_api_key = os.getenv('RESEND_API_KEY')
        self.mailtrap_api_key = os.getenv('MAILTRAP_API_TOKEN')
        
        self.sender_email = os.getenv('ARTICLES_SENDER_EMAIL', 'articles@leakerflow.com')
        self.sender_name = os.getenv('ARTICLES_SENDER_NAME', 'Leaker Flow Articles Team')
        self.base_url = os.getenv('FRONTEND_BASE_URL', 'https://app.leakerflow.com')
        
        # Initialize the appropriate client
        self.client = None
        self.client_type = None
        
        if self.resend_api_key:
            try:
                import resend
                resend.api_key = self.resend_api_key
                self.client = resend
                self.client_type = 'resend'
                logger.info("Initialized Articles Email Service with Resend")
            except ImportError:
                logger.warning("Resend not installed, falling back to Mailtrap")
                self._init_mailtrap()
        else:
            logger.info("RESEND_API_KEY not found, using Mailtrap")
            self._init_mailtrap()
    
    def _init_mailtrap(self):
        """Initialize Mailtrap client as fallback"""
        if self.mailtrap_api_key:
            try:
                import mailtrap as mt
                self.client = mt.MailtrapClient(token=self.mailtrap_api_key)
                self.client_type = 'mailtrap'
                logger.info("Initialized Articles Email Service with Mailtrap")
            except ImportError:
                logger.error("Neither Resend nor Mailtrap could be initialized")
                self.client = None
        else:
            logger.warning("No email service configured - neither RESEND_API_KEY nor MAILTRAP_API_TOKEN found")
    
    def send_application_notification(
        self, 
        user_email: str, 
        user_name: str, 
        status: ApplicationStatus,
        admin_notes: Optional[str] = None,
        rejection_reason: Optional[str] = None
    ) -> bool:
        """Send email notification about application status change"""
        
        if not self.client:
            logger.error("Cannot send email: No email service configured")
            return False
        
        template = self._get_application_email_template(
            user_name=user_name,
            status=status,
            admin_notes=admin_notes,
            rejection_reason=rejection_reason
        )
        
        return self._send_email(
            to_email=user_email,
            to_name=user_name,
            subject=template.subject,
            html_content=template.html_content,
            text_content=template.text_content
        )
    
    def send_admin_new_application_notification(
        self,
        admin_email: str,
        admin_name: str,
        applicant_name: str,
        applicant_email: str,
        application_id: str
    ) -> bool:
        """Send notification to admins when new application is submitted"""
        
        if not self.client:
            logger.error("Cannot send email: No email service configured")
            return False
        
        template = self._get_admin_notification_template(
            admin_name=admin_name,
            applicant_name=applicant_name,
            applicant_email=applicant_email,
            application_id=application_id
        )
        
        return self._send_email(
            to_email=admin_email,
            to_name=admin_name,
            subject=template.subject,
            html_content=template.html_content,
            text_content=template.text_content
        )
    
    def _send_email(
        self, 
        to_email: str, 
        to_name: str, 
        subject: str, 
        html_content: str, 
        text_content: str
    ) -> bool:
        """Send email using the configured service"""
        
        try:
            if self.client_type == 'resend':
                response = self.client.emails.send({
                    "from": f"{self.sender_name} <{self.sender_email}>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                    "text": text_content,
                })
                logger.info(f"Email sent via Resend to {to_email}. Response: {response}")
                return True
                
            elif self.client_type == 'mailtrap':
                import mailtrap as mt
                mail = mt.Mail(
                    sender=mt.Address(email=self.sender_email, name=self.sender_name),
                    to=[mt.Address(email=to_email, name=to_name)],
                    subject=subject,
                    text=text_content,
                    html=html_content,
                    category="articles_application"
                )
                
                response = self.client.send(mail)
                logger.info(f"Email sent via Mailtrap to {to_email}. Response: {response}")
                return True
            
            else:
                logger.error("No valid email client configured")
                return False
                
        except Exception as e:
            logger.error(f"Error sending email to {to_email}: {str(e)}")
            return False
    
    def _get_application_email_template(
        self, 
        user_name: str, 
        status: ApplicationStatus,
        admin_notes: Optional[str] = None,
        rejection_reason: Optional[str] = None
    ) -> EmailTemplate:
        """Get email template based on application status"""
        
        status_templates = {
            ApplicationStatus.SUBMITTED: self._get_submitted_template(user_name),
            ApplicationStatus.UNDER_REVIEW: self._get_under_review_template(user_name),
            ApplicationStatus.APPROVED: self._get_approved_template(user_name),
            ApplicationStatus.REJECTED: self._get_rejected_template(user_name, rejection_reason),
            ApplicationStatus.REQUIRES_CHANGES: self._get_requires_changes_template(user_name, admin_notes),
        }
        
        return status_templates.get(status, self._get_submitted_template(user_name))
    
    def _get_submitted_template(self, user_name: str) -> EmailTemplate:
        """Template for application submission confirmation"""
        subject = "✅ Your Author Application Has Been Received - Leaker Flow"
        
        html_content = f"""
        <h2>🎉 Application Received!</h2>
        <p>Hi {user_name},</p>
        <p>Thank you for applying to become an author on Leaker Flow! We've successfully received your application and are excited to review it.</p>
        <p><strong>What happens next?</strong></p>
        <ul>
            <li>Our team will review your application within 2-3 business days</li>
            <li>We'll evaluate your experience, portfolio, and motivation</li>
            <li>You'll receive an email with our decision</li>
        </ul>
        <p>Best regards,<br><strong>The Leaker Flow Articles Team</strong></p>
        <p><a href="{self.base_url}/applications">Check Application Status</a></p>
        """
        
        text_content = f"""
        Hi {user_name},
        
        Thank you for applying to become an author on Leaker Flow! We've successfully received your application and are excited to review it.
        
        What happens next?
        - Our team will review your application within 2-3 business days
        - We'll evaluate your experience, portfolio, and motivation  
        - You'll receive an email with our decision
        
        Best regards,
        The Leaker Flow Articles Team
        
        Check your application status: {self.base_url}/applications
        """
        
        return EmailTemplate(subject, html_content, text_content)
    
    def _get_approved_template(self, user_name: str) -> EmailTemplate:
        """Template for approved application"""
        subject = "🎉 Congratulations! Your Author Application Has Been Approved - Leaker Flow"
        
        html_content = f"""
        <h2>🎉 Welcome to the Leaker Flow Authors Community!</h2>
        <p>Hi {user_name},</p>
        <p><strong>Congratulations!</strong> We're thrilled to inform you that your author application has been approved! Welcome to the Leaker Flow authors community.</p>
        <p><strong>🚀 You now have access to:</strong></p>
        <ul>
            <li>Create and publish articles</li>
            <li>Access to the Articles Dashboard</li>
            <li>Analytics and engagement metrics</li>
            <li>Article management tools</li>
        </ul>
        <p>Ready to get started? Click below to access your new Articles Dashboard and create your first article!</p>
        <p><a href="{self.base_url}/articles" style="background-color: #16a34a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Start Writing!</a></p>
        <p>Best regards,<br><strong>The Leaker Flow Articles Team</strong></p>
        """
        
        text_content = f"""
        Hi {user_name},
        
        Congratulations! We're thrilled to inform you that your author application has been approved! Welcome to the Leaker Flow authors community.
        
        🚀 You now have access to:
        - Create and publish articles
        - Access to the Articles Dashboard  
        - Analytics and engagement metrics
        - Article management tools
        
        Ready to get started? Visit your Articles Dashboard to create your first article: {self.base_url}/articles
        
        Best regards,
        The Leaker Flow Articles Team
        """
        
        return EmailTemplate(subject, html_content, text_content)
    
    def _get_rejected_template(self, user_name: str, rejection_reason: Optional[str] = None) -> EmailTemplate:
        """Template for rejected application"""
        subject = "📝 Update on Your Author Application - Leaker Flow"
        
        reason_section = f"<p><strong>Feedback:</strong> {rejection_reason}</p>" if rejection_reason else ""
        
        html_content = f"""
        <h2>📝 Application Update</h2>
        <p>Hi {user_name},</p>
        <p>Thank you for your interest in becoming an author on Leaker Flow. After careful review of your application, we've decided not to approve it at this time.</p>
        {reason_section}
        <p><strong>Don't give up!</strong> We encourage you to continue developing your writing skills and consider reapplying in the future.</p>
        <p>Best regards,<br><strong>The Leaker Flow Articles Team</strong></p>
        """
        
        reason_text = f"\n\nFeedback: {rejection_reason}\n" if rejection_reason else ""
        
        text_content = f"""
        Hi {user_name},
        
        Thank you for your interest in becoming an author on Leaker Flow. After careful review of your application, we've decided not to approve it at this time.
        {reason_text}
        Don't give up! We encourage you to continue developing your writing skills and consider reapplying in the future.
        
        Best regards,
        The Leaker Flow Articles Team
        """
        
        return EmailTemplate(subject, html_content, text_content)
    
    def _get_under_review_template(self, user_name: str) -> EmailTemplate:
        """Template for application under review"""
        subject = "🔍 Your Author Application is Under Review - Leaker Flow"
        
        html_content = f"""
        <h2>🔍 Application Under Review</h2>
        <p>Hi {user_name},</p>
        <p>Good news! Your author application is currently under detailed review by our team.</p>
        <p><strong>Review Process:</strong> Our team is carefully evaluating your application, including your writing experience, portfolio, and motivation.</p>
        <p>We'll update you on the status as soon as our review is complete. Thank you for your patience!</p>
        <p>Best regards,<br><strong>The Leaker Flow Articles Team</strong></p>
        <p><a href="{self.base_url}/applications">Check Application Status</a></p>
        """
        
        text_content = f"""
        Hi {user_name},
        
        Good news! Your author application is currently under detailed review by our team.
        
        Review Process: Our team is carefully evaluating your application, including your writing experience, portfolio, and motivation.
        
        We'll update you on the status as soon as our review is complete. Thank you for your patience!
        
        Best regards,
        The Leaker Flow Articles Team
        
        Check your application status: {self.base_url}/applications
        """
        
        return EmailTemplate(subject, html_content, text_content)
    
    def _get_requires_changes_template(self, user_name: str, admin_notes: Optional[str] = None) -> EmailTemplate:
        """Template for application requiring changes"""
        subject = "📝 Action Required: Updates Needed for Your Author Application - Leaker Flow"
        
        notes_section = f"<p><strong>Required Changes:</strong> {admin_notes}</p>" if admin_notes else ""
        
        html_content = f"""
        <h2>📝 Application Updates Needed</h2>
        <p>Hi {user_name},</p>
        <p>Thank you for your author application! We've reviewed it and would like to give you the opportunity to strengthen your application with some updates.</p>
        {notes_section}
        <p>Please review the feedback above and update your application accordingly. We're looking forward to seeing your revised submission!</p>
        <p><a href="{self.base_url}/applications">Update Application</a></p>
        <p>Best regards,<br><strong>The Leaker Flow Articles Team</strong></p>
        """
        
        notes_text = f"\n\nRequired Changes: {admin_notes}\n" if admin_notes else ""
        
        text_content = f"""
        Hi {user_name},
        
        Thank you for your author application! We've reviewed it and would like to give you the opportunity to strengthen your application with some updates.
        {notes_text}
        Please review the feedback above and update your application accordingly. We're looking forward to seeing your revised submission!
        
        Update your application: {self.base_url}/applications
        
        Best regards,
        The Leaker Flow Articles Team
        """
        
        return EmailTemplate(subject, html_content, text_content)
    
    def _get_admin_notification_template(
        self,
        admin_name: str,
        applicant_name: str, 
        applicant_email: str,
        application_id: str
    ) -> EmailTemplate:
        """Template for admin notification of new application"""
        subject = f"🔔 New Author Application Submitted by {applicant_name} - Leaker Flow"
        
        html_content = f"""
        <h2>🔔 New Author Application</h2>
        <p>Hi {admin_name},</p>
        <p>A new author application has been submitted and is ready for review.</p>
        <p><strong>Application Details:</strong></p>
        <ul>
            <li><strong>Applicant:</strong> {applicant_name}</li>
            <li><strong>Email:</strong> {applicant_email}</li>
            <li><strong>Application ID:</strong> {application_id}</li>
            <li><strong>Status:</strong> Pending Review</li>
        </ul>
        <p>Please review the application at your earliest convenience.</p>
        <p><a href="{self.base_url}/admin/applications/{application_id}">Review Application</a></p>
        <p>Best regards,<br><strong>Leaker Flow System</strong></p>
        """
        
        text_content = f"""
        Hi {admin_name},
        
        A new author application has been submitted and is ready for review.
        
        Application Details:
        - Applicant: {applicant_name}
        - Email: {applicant_email}  
        - Application ID: {application_id}
        - Status: Pending Review
        
        Please review the application at your earliest convenience.
        
        Review application: {self.base_url}/admin/applications/{application_id}
        
        Best regards,
        Leaker Flow System
        """
        
        return EmailTemplate(subject, html_content, text_content)

# Global instance
articles_email_service = ArticlesEmailService()
