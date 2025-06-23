"""
Articles API Router
Handles all article-related endpoints with Basejump multi-tenant support
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional, Dict, Any
from supabase import AsyncClient

from services.articles import (
    articles_service,
    CreateArticleRequest,
    UpdateArticleRequest,
    ArticleFilters,
    ArticlePagination
)
from utils.auth_utils import get_current_user_id_from_jwt, require_global_admin
from utils.logger import logger


router = APIRouter(prefix="/articles", tags=["articles"])

# =======================================================================
# ADMIN-ONLY ENDPOINTS (Demonstração do sistema de verificação de admin)
# =======================================================================

@router.get("/admin/all")
async def get_all_articles_for_admin(
    page: int = 1,
    page_size: int = 50,
    admin_user_id: str = Depends(require_global_admin)
) -> Dict[str, Any]:
    """
    ADMIN ONLY: Get ALL articles from ALL accounts (bypasses normal RLS restrictions).
    
    This endpoint demonstrates the use of the global admin verification system.
    Only users with global admin privileges can access this endpoint.
    """
    try:
        from services.supabase import create_supabase_admin_client
        
        logger.info(f"Admin {admin_user_id} accessing all articles (admin view)")
        
        # Use admin client to bypass normal RLS restrictions
        admin_client = await create_supabase_admin_client()
        
        # Query ALL articles regardless of visibility or account
        query = admin_client.table('articles').select(
            '*, '
            'account:accounts!account_id(id, name, slug), '
            'author:profiles!created_by_user_id(id, email, full_name)',
            count='exact'
        )
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)
        
        # Order by creation date (newest first)
        query = query.order('created_at', desc=True)
        
        # Execute query
        result = await query.execute()
        
        # Close admin client
        await admin_client.close()
        
        logger.info(f"Admin {admin_user_id} retrieved {len(result.data or [])} articles from admin view")
        
        return {
            'articles': result.data,
            'total_count': result.count,
            'page': page,
            'page_size': page_size,
            'has_more': offset + page_size < result.count,
            'admin_view': True,
            'accessed_by_admin': admin_user_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all articles for admin: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get articles for admin"
        )

@router.post("/admin/{article_id}/force-publish")
async def force_publish_article_admin(
    article_id: str,
    admin_user_id: str = Depends(require_global_admin)
) -> Dict[str, Any]:
    """
    ADMIN ONLY: Force publish any article regardless of author permissions.
    
    This endpoint demonstrates admin override capabilities.
    """
    try:
        from services.supabase import create_supabase_admin_client
        
        logger.info(f"Admin {admin_user_id} force publishing article {article_id}")
        
        # Use admin client to bypass normal restrictions
        admin_client = await create_supabase_admin_client()
        
        # Check if article exists
        article_result = await admin_client.table('articles').select('id, title, status').eq('id', article_id).execute()
        
        if not article_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Article not found"
            )
        
        article = article_result.data[0]
        
        # Force update status to published and visibility to public
        update_result = await admin_client.table('articles').update({
            'status': 'published',
            'visibility': 'public',
            'updated_at': 'now()'
        }).eq('id', article_id).execute()
        
        # Close admin client
        await admin_client.close()
        
        logger.info(f"Admin {admin_user_id} successfully force published article {article_id}")
        
        return {
            'message': 'Article force published successfully',
            'article_id': article_id,
            'article_title': article['title'],
            'previous_status': article['status'],
            'new_status': 'published',
            'admin_action_by': admin_user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error force publishing article {article_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to force publish article"
        )

# =======================================================================
# REGULAR USER ENDPOINTS (Existing functionality)
# =======================================================================

@router.post("/")
async def create_article(
    data: CreateArticleRequest,
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> Dict[str, Any]:
    """
    Create a new article in the specified account.
    
    The created_by_user_id will always be set to the current authenticated user.
    """
    try:
        logger.info(f"Creating article for user {user_id} in account {data.account_id}")
        article = await articles_service.create_article(user_id, data)
        return article
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating article: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create article"
        )


@router.put("/{article_id}")
async def update_article(
    article_id: str,
    data: UpdateArticleRequest,
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> Dict[str, Any]:
    """
    Update an existing article.
    
    Only the author or account admin/owner can update articles.
    """
    try:
        logger.info(f"Updating article {article_id} for user {user_id}")
        article = await articles_service.update_article(user_id, article_id, data)
        return article
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating article: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update article"
        )


@router.delete("/{article_id}")
async def delete_article(
    article_id: str,
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> Dict[str, str]:
    """
    Delete an article.
    
    Only account admin/owner can delete articles.
    """
    try:
        logger.info(f"Deleting article {article_id} for user {user_id}")
        await articles_service.delete_article(user_id, article_id)
        return {"message": "Article deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting article: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete article"
        )


@router.get("/")
async def get_articles(
    page: int = 1,
    page_size: int = 10,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    visibility: Optional[str] = None,
    account_id: Optional[str] = None,
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> Dict[str, Any]:
    """
    Get paginated articles with filters.
    
    Returns articles that the user has permission to view based on:
    - Public published articles
    - Articles from accounts where user is a member
    - Private articles created by the user
    """
    try:
        pagination = ArticlePagination(page=page, page_size=page_size)
        filters = ArticleFilters(
            status=status,
            category=category,
            search=search,
            visibility=visibility,
            account_id=account_id
        )
        
        logger.info(f"Getting articles for user {user_id} with filters: {filters}")
        result = await articles_service.get_articles(user_id, pagination, filters)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting articles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get articles"
        )


@router.get("/{article_id}")
async def get_article(
    article_id: str,
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> Dict[str, Any]:
    """
    Get a single article by ID.
    
    Returns the article if the user has permission to view it.
    """
    try:
        logger.info(f"Getting article {article_id} for user {user_id}")
        article = await articles_service.get_article_by_id(user_id, article_id)
        return article
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting article: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get article"
        )


@router.post("/{article_id}/vote")
async def vote_on_article(
    article_id: str,
    vote_type: str,  # 'upvote' or 'downvote'
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> Dict[str, Any]:
    """
    Vote on an article.
    
    Clicking the same vote type again will remove the vote.
    """
    try:
        if vote_type not in ['upvote', 'downvote']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vote type must be 'upvote' or 'downvote'"
            )
        
        logger.info(f"User {user_id} voting {vote_type} on article {article_id}")
        article = await articles_service.vote_on_article(user_id, article_id, vote_type)
        return article
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error voting on article: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to vote on article"
        )


@router.get("/stats/{account_id}")
async def get_account_article_stats(
    account_id: str,
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> Dict[str, Any]:
    """
    Get article statistics for an account.
    
    Only account members can view stats.
    """
    try:
        logger.info(f"Getting article stats for account {account_id} requested by user {user_id}")
        stats = await articles_service.get_account_articles_stats(user_id, account_id)
        return stats
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting account stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get account statistics"
        )


# Public endpoints (no authentication required)

@router.get("/public/discover")
async def get_public_articles(
    page: int = 1,
    page_size: int = 10,
    category: Optional[str] = None,
    search: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get public articles for the discover page.
    
    No authentication required - only returns public published articles.
    """
    try:
        # Use admin client for public access
        from services.supabase import create_supabase_admin_client
        admin_client = await create_supabase_admin_client()
        
        # Build query for public articles only
        query = admin_client.table('articles').select(
            '*, '
            'account:accounts!account_id(id, name, slug, personal_account), '
            'created_by:auth.users!created_by_user_id(id, email, raw_user_meta_data)',
            count='exact'
        ).eq('visibility', 'public').eq('status', 'published')
        
        # Apply filters
        if category:
            query = query.eq('category', category)
        
        if search:
            search_term = f"%{search}%"
            query = query.or_(f"title.ilike.{search_term},subtitle.ilike.{search_term}")
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)
        
        # Order by trend score for discover page
        query = query.order('trend_score', desc=True)
        
        # Execute query
        result = await query.execute()
        
        return {
            'articles': result.data,
            'total_count': result.count,
            'page': page,
            'page_size': page_size,
            'has_more': offset + page_size < result.count
        }
    except Exception as e:
        logger.error(f"Error getting public articles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get public articles"
        ) 