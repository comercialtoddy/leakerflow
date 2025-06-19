"""
Articles Service with Basejump Multi-tenant Support
This service manages articles with proper account-based multi-tenancy
"""

from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from fastapi import HTTPException, status
from supabase import AsyncClient
from pydantic import BaseModel, Field, validator
import uuid
import json

from services.supabase import create_supabase_admin_client, create_supabase_client


# =======================
# PYDANTIC MODELS
# =======================

class ArticleSection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    media: List[Dict[str, Any]] = []
    sources: List[Dict[str, Any]] = []
    order: int


class CreateArticleRequest(BaseModel):
    title: str
    subtitle: str
    content: str
    category: str
    tags: List[str] = []
    author: str  # Display name only - created_by_user_id is set by backend
    status: Literal['draft', 'published', 'archived', 'scheduled'] = 'draft'
    visibility: Literal['private', 'account', 'public'] = 'account'
    media_items: List[Dict[str, Any]] = []
    sources: List[Dict[str, Any]] = []
    sections: List[ArticleSection] = []
    read_time: str
    image_url: Optional[str] = None
    publish_date: Optional[datetime] = None
    account_id: str  # Required - which account owns this article

    @validator('tags')
    def validate_tags(cls, v):
        if len(v) > 10:
            raise ValueError('Maximum 10 tags allowed')
        return v


class UpdateArticleRequest(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[Literal['draft', 'published', 'archived', 'scheduled']] = None
    visibility: Optional[Literal['private', 'account', 'public']] = None
    media_items: Optional[List[Dict[str, Any]]] = None
    sources: Optional[List[Dict[str, Any]]] = None
    sections: Optional[List[ArticleSection]] = None
    read_time: Optional[str] = None
    image_url: Optional[str] = None
    publish_date: Optional[datetime] = None


class ArticleFilters(BaseModel):
    status: Optional[str] = None
    category: Optional[str] = None
    search: Optional[str] = None
    visibility: Optional[Literal['private', 'account', 'public']] = None
    account_id: Optional[str] = None


class ArticlePagination(BaseModel):
    page: int = 1
    page_size: int = 10

    @validator('page_size')
    def validate_page_size(cls, v):
        if v > 100:
            raise ValueError('Page size cannot exceed 100')
        return v


# =======================
# SERVICE CLASS
# =======================

class ArticlesService:
    def __init__(self):
        # Size limits for hybrid storage
        self.MAX_CONTENT_SIZE = 50000  # 50K characters
        self.MAX_MEDIA_ITEMS = 20
        self.MAX_SOURCES = 50
        self.STORAGE_THRESHOLD = 4000  # Store in Supabase Storage if > 4KB
        self.TOTAL_PAYLOAD_LIMIT = 1000000  # 1MB total payload

    async def _check_account_permission(
        self, 
        supabase: AsyncClient, 
        user_id: str, 
        account_id: str,
        required_roles: List[str] = ['owner', 'admin', 'member']
    ) -> Dict[str, Any]:
        """Check if user has permission in the account"""
        result = await supabase.table('account_user').select('*').eq(
            'user_id', user_id
        ).eq('account_id', account_id).single().execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this account"
            )
        
        membership = result.data
        if membership['account_role'] not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {required_roles}"
            )
        
        return membership

    async def _check_article_permission(
        self,
        supabase: AsyncClient,
        user_id: str,
        article_id: str,
        action: Literal['view', 'edit', 'delete', 'publish']
    ) -> bool:
        """Check if user can perform action on article"""
        # Get article details
        article_result = await supabase.table('articles').select(
            'account_id, created_by_user_id, visibility, status'
        ).eq('id', article_id).single().execute()
        
        if not article_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Article not found"
            )
        
        article = article_result.data
        
        # Public articles can be viewed by anyone
        if (action == 'view' and 
            article['visibility'] == 'public' and 
            article['status'] == 'published'):
            return True
        
        # Check account membership
        try:
            membership = await self._check_account_permission(
                supabase, user_id, article['account_id']
            )
        except HTTPException:
            return False
        
        # Permission matrix
        if action == 'view':
            return True  # Members can always view
        
        elif action == 'edit':
            # Author can edit, or admin/owner
            return (article['created_by_user_id'] == user_id or 
                   membership['account_role'] in ['owner', 'admin'])
        
        elif action in ['delete', 'publish']:
            # Only admin/owner can delete or publish
            return membership['account_role'] in ['owner', 'admin']
        
        return False

    async def create_article(
        self,
        user_id: str,
        data: CreateArticleRequest
    ) -> Dict[str, Any]:
        """Create a new article in an account"""
        supabase = await create_supabase_client(user_id)
        
        # Verify user is member of the account
        await self._check_account_permission(
            supabase, user_id, data.account_id
        )
        
        # Generate article ID for storage operations
        article_id = str(uuid.uuid4())
        
        # Validate and optimize payload
        article_data = await self._validate_payload_size(
            data.dict(exclude_unset=True), 
            article_id
        )
        
        # Force created_by_user_id to be the current user
        article_data['id'] = article_id
        article_data['created_by_user_id'] = user_id
        article_data['user_id'] = user_id  # Legacy field
        
        # Create article
        result = await supabase.table('articles').insert(article_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create article"
            )
        
        # Return created article with account info
        return await self.get_article_by_id(user_id, result.data[0]['id'])

    async def update_article(
        self,
        user_id: str,
        article_id: str,
        data: UpdateArticleRequest
    ) -> Dict[str, Any]:
        """Update an existing article"""
        supabase = await create_supabase_client(user_id)
        
        # Check permission
        can_edit = await self._check_article_permission(
            supabase, user_id, article_id, 'edit'
        )
        
        if not can_edit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to edit this article"
            )
        
        # Get current article to preserve account_id and created_by_user_id
        current = await supabase.table('articles').select(
            'account_id, created_by_user_id'
        ).eq('id', article_id).single().execute()
        
        if not current.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Article not found"
            )
        
        # Validate and optimize payload
        update_data = await self._validate_payload_size(
            data.dict(exclude_unset=True), 
            article_id
        )
        
        # Ensure critical fields don't change
        update_data['account_id'] = current.data['account_id']
        update_data['created_by_user_id'] = current.data['created_by_user_id']
        
        # Update article
        result = await supabase.table('articles').update(
            update_data
        ).eq('id', article_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update article"
            )
        
        return await self.get_article_by_id(user_id, article_id)

    async def delete_article(self, user_id: str, article_id: str) -> bool:
        """Delete an article"""
        supabase = await create_supabase_client(user_id)
        
        # Check permission
        can_delete = await self._check_article_permission(
            supabase, user_id, article_id, 'delete'
        )
        
        if not can_delete:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this article"
            )
        
        # Delete from storage if content was stored there
        article = await supabase.table('articles').select(
            'content_storage_path, sections_storage_path, media_items_storage_path, sources_storage_path'
        ).eq('id', article_id).single().execute()
        
        if article.data:
            # Clean up storage files
            storage_paths = [
                article.data.get('content_storage_path'),
                article.data.get('sections_storage_path'),
                article.data.get('media_items_storage_path'),
                article.data.get('sources_storage_path')
            ]
            
            for path in storage_paths:
                if path:
                    try:
                        await supabase.storage.from_('articles-media').remove([path])
                    except Exception as e:
                        print(f"Failed to delete storage file {path}: {e}")
        
        # Delete article
        result = await supabase.table('articles').delete().eq(
            'id', article_id
        ).execute()
        
        return True

    async def get_articles(
        self,
        user_id: str,
        pagination: ArticlePagination,
        filters: ArticleFilters
    ) -> Dict[str, Any]:
        """Get paginated articles with filters"""
        supabase = await create_supabase_client(user_id)
        
        # Build query
        query = supabase.table('articles').select(
            '*, '
            'account:accounts!account_id(id, name, slug, personal_account), '
            'created_by:auth.users!created_by_user_id(id, email, raw_user_meta_data)',
            count='exact'
        )
        
        # Apply filters
        if filters.status:
            query = query.eq('status', filters.status)
        
        if filters.category:
            query = query.eq('category', filters.category)
        
        if filters.visibility:
            query = query.eq('visibility', filters.visibility)
        
        if filters.account_id:
            query = query.eq('account_id', filters.account_id)
        
        # Apply search (simple ILIKE on title/subtitle)
        if filters.search:
            search_term = f"%{filters.search}%"
            query = query.or_(f"title.ilike.{search_term},subtitle.ilike.{search_term}")
        
        # Apply pagination
        offset = (pagination.page - 1) * pagination.page_size
        query = query.range(offset, offset + pagination.page_size - 1)
        
        # Order by created_at desc
        query = query.order('created_at', desc=True)
        
        # Execute query
        result = await query.execute()
        
        # Process articles to retrieve content from storage
        articles = []
        for article in result.data:
            processed = await self._process_article_content(supabase, article)
            articles.append(processed)
        
        return {
            'articles': articles,
            'total_count': result.count,
            'page': pagination.page,
            'page_size': pagination.page_size,
            'has_more': offset + pagination.page_size < result.count
        }

    async def get_article_by_id(
        self, 
        user_id: str, 
        article_id: str
    ) -> Dict[str, Any]:
        """Get a single article by ID"""
        supabase = await create_supabase_client(user_id)
        
        # Check permission
        can_view = await self._check_article_permission(
            supabase, user_id, article_id, 'view'
        )
        
        if not can_view:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this article"
            )
        
        # Get article with relations
        result = await supabase.table('articles').select(
            '*, '
            'account:accounts!account_id(id, name, slug, personal_account), '
            'created_by:auth.users!created_by_user_id(id, email, raw_user_meta_data), '
            'votes:article_votes(vote_type, user_id)'
        ).eq('id', article_id).single().execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Article not found"
            )
        
        # Process content from storage
        article = await self._process_article_content(supabase, result.data)
        
        # Add user's vote status
        user_votes = [v for v in article.get('votes', []) if v['user_id'] == user_id]
        article['user_vote'] = user_votes[0]['vote_type'] if user_votes else None
        
        return article

    async def get_account_articles_stats(
        self, 
        user_id: str, 
        account_id: str
    ) -> Dict[str, Any]:
        """Get article statistics for an account"""
        supabase = await create_supabase_client(user_id)
        
        # Check permission
        await self._check_account_permission(supabase, user_id, account_id)
        
        # Get stats from view
        result = await supabase.table('account_article_stats').select('*').eq(
            'account_id', account_id
        ).single().execute()
        
        if not result.data:
            return {
                'account_id': account_id,
                'total_articles': 0,
                'published_articles': 0,
                'draft_articles': 0,
                'total_views': 0,
                'total_votes': 0
            }
        
        return result.data

    # =======================
    # VOTING SYSTEM
    # =======================

    async def vote_on_article(
        self,
        user_id: str,
        article_id: str,
        vote_type: Literal['upvote', 'downvote']
    ) -> Dict[str, Any]:
        """Vote on an article"""
        supabase = await create_supabase_client(user_id)
        
        # Check if user can view the article (required to vote)
        can_view = await self._check_article_permission(
            supabase, user_id, article_id, 'view'
        )
        
        if not can_view:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot vote on articles you cannot view"
            )
        
        # Check existing vote
        existing = await supabase.table('article_votes').select('*').eq(
            'article_id', article_id
        ).eq('user_id', user_id).execute()
        
        if existing.data:
            # Update existing vote
            if existing.data[0]['vote_type'] == vote_type:
                # Remove vote if clicking same type
                await supabase.table('article_votes').delete().eq(
                    'article_id', article_id
                ).eq('user_id', user_id).execute()
            else:
                # Change vote type
                await supabase.table('article_votes').update({
                    'vote_type': vote_type
                }).eq('article_id', article_id).eq('user_id', user_id).execute()
        else:
            # Create new vote
            await supabase.table('article_votes').insert({
                'article_id': article_id,
                'user_id': user_id,
                'vote_type': vote_type
            }).execute()
        
        # Return updated article with new vote counts
        return await self.get_article_by_id(user_id, article_id)

    # =======================
    # PRIVATE METHODS
    # =======================

    async def _validate_payload_size(
        self, 
        data: Dict[str, Any], 
        article_id: str
    ) -> Dict[str, Any]:
        """Validate payload size and move large content to storage"""
        result = data.copy()
        
        # Check content size
        if 'content' in result and len(result['content']) > self.STORAGE_THRESHOLD:
            # Store in Supabase Storage
            storage_path = await self._store_content_in_storage(
                result['content'], article_id
            )
            result['content'] = f"[STORED_IN_STORAGE:{storage_path}]"
            result['content_storage_path'] = storage_path
            result['content_size'] = len(data['content'])
        
        # Similar checks for sections, media_items, sources...
        # (Implementation details omitted for brevity)
        
        return result

    async def _store_content_in_storage(
        self, 
        content: str, 
        article_id: str
    ) -> str:
        """Store content in Supabase Storage"""
        # Implementation for storing in Supabase Storage
        # Returns the storage path
        pass

    async def _process_article_content(
        self,
        supabase: AsyncClient,
        article: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process article to retrieve content from storage if needed"""
        result = article.copy()
        
        # Check if content is in storage
        if (result.get('content', '').startswith('[STORED_IN_STORAGE:') and 
            result.get('content_storage_path')):
            # Retrieve from storage
            content = await self._get_content_from_storage(
                supabase, result['content_storage_path']
            )
            result['content'] = content
        
        # Similar processing for sections, media_items, sources...
        
        return result

    async def _get_content_from_storage(
        self,
        supabase: AsyncClient,
        storage_path: str
    ) -> str:
        """Retrieve content from Supabase Storage"""
        # Implementation for retrieving from Supabase Storage
        pass


# =======================
# SINGLETON INSTANCE
# =======================

articles_service = ArticlesService() 