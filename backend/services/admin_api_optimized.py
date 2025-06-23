"""
Optimized Admin API for Leaker-Flow Backend Performance
Enhanced version of admin endpoints with Redis caching, query optimization, and async improvements.
"""

import asyncio
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request, Depends, Query, BackgroundTasks
from pydantic import BaseModel

from utils.auth_utils import require_global_admin
from services.supabase import create_supabase_admin_client
from utils.logger import logger
from utils.cache import cached, cache_manager, data_optimizer
from utils.performance_profiling import profiler_manager

# Import existing models
from services.admin_api import (
    AdminStatsResponse, ArticleAdminView, ApplicationAdminView, 
    AuthorAdminView, AuditLogEntryResponse, AnalyticsOverviewResponse
)

router = APIRouter()

# =======================================================================
# OPTIMIZED STATS AND ANALYTICS
# =======================================================================

@cached("admin_stats", "dashboard_overview")
async def _get_optimized_admin_stats() -> Dict[str, Any]:
    """Optimized admin stats with database function"""
    try:
        async with profiler_manager.profile_operation("admin_stats_query"):
            admin_client = await create_supabase_admin_client()
            
            # Use optimized database functions
            analytics_result = await admin_client.rpc('get_analytics_overview_optimized').execute()
            
            if analytics_result.data:
                stats_data = analytics_result.data[0]
                await admin_client.close()
                return stats_data
            
            # Fallback to individual queries if function doesn't exist
            stats_queries = await asyncio.gather(
                admin_client.table('articles').select('id', count='exact').execute(),
                admin_client.table('author_applications').select('id,status', count='exact').execute(),
                admin_client.table('profiles').select('id', count='exact').execute(),
                admin_client.schema('basejump').from_('accounts').select('id', count='exact').execute(),
                return_exceptions=True
            )
            
            # Process results
            total_articles = stats_queries[0].count if not isinstance(stats_queries[0], Exception) else 0
            applications_result = stats_queries[1] if not isinstance(stats_queries[1], Exception) else None
            total_users = stats_queries[2].count if not isinstance(stats_queries[2], Exception) else 0
            total_accounts = stats_queries[3].count if not isinstance(stats_queries[3], Exception) else 0
            
            # Process applications breakdown
            total_applications = 0
            pending_applications = 0
            approved_applications = 0
            rejected_applications = 0
            
            if applications_result and applications_result.data:
                applications_data = applications_result.data
                total_applications = len(applications_data)
                
                status_counts = {}
                for app in applications_data:
                    status = app.get('status', 'unknown')
                    status_counts[status] = status_counts.get(status, 0) + 1
                
                pending_applications = status_counts.get('pending', 0)
                approved_applications = status_counts.get('approved', 0)
                rejected_applications = status_counts.get('rejected', 0)
            
            await admin_client.close()
            
            return {
                'total_articles': total_articles,
                'total_applications': total_applications,
                'total_users': total_users,
                'total_accounts': total_accounts,
                'pending_applications': pending_applications,
                'approved_applications': approved_applications,
                'rejected_applications': rejected_applications
            }
    
    except Exception as e:
        logger.error(f"Error in optimized admin stats: {e}")
        raise


@router.get("/admin/stats/optimized", response_model=AdminStatsResponse)
async def get_admin_stats_optimized(
    background_tasks: BackgroundTasks,
    admin_user_id: str = Depends(require_global_admin)
):
    """Get optimized admin stats with caching"""
    try:
        with profiler_manager.profile_operation("admin_stats_endpoint"):
            stats_data = await _get_optimized_admin_stats()
            
            # Schedule background cache warmup for related endpoints
            background_tasks.add_task(_warmup_related_caches)
            
            return AdminStatsResponse(**stats_data)
    
    except Exception as e:
        logger.error(f"Error getting optimized admin stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve admin statistics")


async def _warmup_related_caches():
    """Background task to warm up related caches"""
    try:
        await asyncio.gather(
            _get_optimized_articles_list(page=1, per_page=20),
            _get_optimized_applications_list(page=1, per_page=20),
            _get_optimized_authors_list(page=1, per_page=20),
            return_exceptions=True
        )
        logger.info("Cache warmup completed for related admin endpoints")
    except Exception as e:
        logger.error(f"Cache warmup failed: {e}")


# =======================================================================
# OPTIMIZED ARTICLES MANAGEMENT
# =======================================================================

@cached("article_lists", "admin_pagination")
async def _get_optimized_articles_list(
    page: int = 1, 
    per_page: int = 20, 
    status: Optional[str] = None,
    visibility: Optional[str] = None
) -> Dict[str, Any]:
    """Optimized articles list with database function"""
    try:
        async with profiler_manager.profile_operation("articles_list_query"):
            admin_client = await create_supabase_admin_client()
            
            # Use optimized database function
            function_params = {
                'p_page': page,
                'p_per_page': per_page,
                'p_status': status,
                'p_visibility': visibility
            }
            
            result = await admin_client.rpc('get_articles_admin_optimized', function_params).execute()
            
            if result.data:
                articles_data = result.data
                await admin_client.close()
                
                # Optimize data for API response
                optimized_articles = data_optimizer.optimize_article_data(articles_data)
                
                return {
                    'articles': optimized_articles,
                    'total': len(optimized_articles),
                    'page': page,
                    'per_page': per_page
                }
            
            await admin_client.close()
            return {'articles': [], 'total': 0, 'page': page, 'per_page': per_page}
    
    except Exception as e:
        logger.error(f"Error in optimized articles list: {e}")
        raise


@router.get("/admin/articles/optimized")
async def get_articles_admin_optimized(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    visibility: Optional[str] = Query(None),
    admin_user_id: str = Depends(require_global_admin)
):
    """Get optimized articles list with caching and pagination"""
    try:
        with profiler_manager.profile_operation("articles_admin_endpoint"):
            result = await _get_optimized_articles_list(page, per_page, status, visibility)
            return result
    
    except Exception as e:
        logger.error(f"Error getting optimized articles: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve articles")


# =======================================================================
# OPTIMIZED APPLICATIONS MANAGEMENT  
# =======================================================================

@cached("application_lists", "admin_pagination") 
async def _get_optimized_applications_list(
    page: int = 1,
    per_page: int = 20,
    status: Optional[str] = None
) -> Dict[str, Any]:
    """Optimized applications list with efficient queries"""
    try:
        async with profiler_manager.profile_operation("applications_list_query"):
            admin_client = await create_supabase_admin_client()
            
            # Build efficient query
            skip = (page - 1) * per_page
            query = admin_client.table('author_applications').select(
                'id, user_id, full_name, email, bio, writing_experience, '
                'portfolio_links, motivation, status, submitted_at, reviewed_at, '
                'reviewed_by, review_notes, rejection_reason'
            )
            
            # Apply filters
            if status:
                query = query.eq('status', status)
            
            # Apply pagination with efficient ordering
            query = query.order('submitted_at', desc=True).range(skip, skip + per_page - 1)
            
            result = await query.execute()
            applications_data = result.data or []
            
            await admin_client.close()
            
            return {
                'applications': applications_data,
                'total': len(applications_data),
                'page': page,
                'per_page': per_page
            }
    
    except Exception as e:
        logger.error(f"Error in optimized applications list: {e}")
        raise


@router.get("/admin/applications/optimized")
async def get_applications_admin_optimized(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    admin_user_id: str = Depends(require_global_admin)
):
    """Get optimized applications list with caching"""
    try:
        with profiler_manager.profile_operation("applications_admin_endpoint"):
            result = await _get_optimized_applications_list(page, per_page, status)
            return result
    
    except Exception as e:
        logger.error(f"Error getting optimized applications: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve applications")


# =======================================================================
# OPTIMIZED AUTHORS MANAGEMENT
# =======================================================================

@cached("author_data", "admin_pagination")
async def _get_optimized_authors_list(
    page: int = 1,
    per_page: int = 20,
    status: Optional[str] = None,
    search: Optional[str] = None
) -> Dict[str, Any]:
    """Optimized authors list with materialized view"""
    try:
        async with profiler_manager.profile_operation("authors_list_query"):
            admin_client = await create_supabase_admin_client()
            
            # Use materialized view for performance
            query = admin_client.table('mv_author_performance').select('*')
            
            # Apply filters
            if status:
                query = query.eq('status', status)
            
            if search:
                # Use GIN index for full-text search
                query = query.or_(f'full_name.ilike.%{search}%,email.ilike.%{search}%')
            
            # Apply pagination
            skip = (page - 1) * per_page
            query = query.order('articles_count', desc=True).range(skip, skip + per_page - 1)
            
            result = await query.execute()
            authors_data = result.data or []
            
            await admin_client.close()
            
            # Optimize author data for response
            optimized_authors = data_optimizer.optimize_author_data(authors_data)
            
            return {
                'authors': optimized_authors,
                'total': len(optimized_authors), 
                'page': page,
                'per_page': per_page
            }
    
    except Exception as e:
        logger.error(f"Error in optimized authors list: {e}")
        raise


@router.get("/admin/authors/optimized")
async def get_authors_admin_optimized(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    admin_user_id: str = Depends(require_global_admin)
):
    """Get optimized authors list with caching and search"""
    try:
        with profiler_manager.profile_operation("authors_admin_endpoint"):
            result = await _get_optimized_authors_list(page, per_page, status, search)
            return result
    
    except Exception as e:
        logger.error(f"Error getting optimized authors: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve authors")


# =======================================================================
# OPTIMIZED ANALYTICS
# =======================================================================

@cached("analytics", "overview_dashboard")
async def _get_optimized_analytics_overview(time_range: str = '30d') -> Dict[str, Any]:
    """Optimized analytics overview using materialized views"""
    try:
        async with profiler_manager.profile_operation("analytics_overview_query"):
            admin_client = await create_supabase_admin_client()
            
            # Calculate date range
            days_map = {'7d': 7, '30d': 30, '90d': 90, '1y': 365}
            days_back = days_map.get(time_range, 30)
            start_date = datetime.utcnow() - timedelta(days=days_back)
            
            # Use multiple materialized views for performance
            queries = await asyncio.gather(
                # Daily stats from materialized view
                admin_client.table('mv_daily_article_stats').select('*')
                .gte('date', start_date.date()).execute(),
                
                # Author performance from materialized view  
                admin_client.table('mv_author_performance').select('*')
                .order('articles_count', desc=True).limit(10).execute(),
                
                # Category analytics from materialized view
                admin_client.table('mv_category_analytics').select('*').execute(),
                
                # Application trends from materialized view
                admin_client.table('mv_application_trends').select('*').execute(),
                
                return_exceptions=True
            )
            
            # Process results
            daily_stats = queries[0].data if not isinstance(queries[0], Exception) else []
            top_authors = queries[1].data if not isinstance(queries[1], Exception) else []
            category_stats = queries[2].data if not isinstance(queries[2], Exception) else []
            app_trends = queries[3].data if not isinstance(queries[3], Exception) else []
            
            # Calculate aggregated metrics
            total_articles = sum(day.get('articles_count', 0) for day in daily_stats)
            total_views = sum(day.get('total_views', 0) for day in daily_stats)
            total_authors = len(top_authors)
            total_users = sum(author.get('total_views', 0) for author in top_authors)  # Proxy metric
            
            # Calculate monthly articles (last 30 days)
            recent_date = datetime.utcnow() - timedelta(days=30)
            articles_this_month = sum(
                day.get('articles_count', 0) 
                for day in daily_stats 
                if datetime.fromisoformat(day.get('date', '1970-01-01')) >= recent_date
            )
            
            # Calculate application approval rate
            total_apps = sum(trend.get('total_applications', 0) for trend in app_trends)
            approved_apps = sum(trend.get('approved_applications', 0) for trend in app_trends)
            approval_rate = (approved_apps / total_apps * 100) if total_apps > 0 else 0
            
            # Estimate engagement rate (simplified)
            avg_views_per_article = (total_views / total_articles) if total_articles > 0 else 0
            engagement_rate = min(avg_views_per_article / 100, 100)  # Simplified calculation
            
            await admin_client.close()
            
            return {
                'total_articles': total_articles,
                'total_authors': total_authors,
                'total_users': total_users,
                'total_views': total_views,
                'articles_this_month': articles_this_month,
                'new_authors_this_month': len([a for a in top_authors if a.get('created_at', '')[:7] == datetime.utcnow().strftime('%Y-%m')]),
                'application_approval_rate': round(approval_rate, 2),
                'average_engagement_rate': round(engagement_rate, 2)
            }
    
    except Exception as e:
        logger.error(f"Error in optimized analytics overview: {e}")
        raise


@router.get("/admin/analytics/overview/optimized", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview_optimized(
    time_range: str = Query('30d', regex='^(7d|30d|90d|1y)$'),
    admin_user_id: str = Depends(require_global_admin)
):
    """Get optimized analytics overview with caching"""
    try:
        with profiler_manager.profile_operation("analytics_overview_endpoint"):
            analytics_data = await _get_optimized_analytics_overview(time_range)
            return AnalyticsOverviewResponse(**analytics_data)
    
    except Exception as e:
        logger.error(f"Error getting optimized analytics overview: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics overview")


# =======================================================================
# OPTIMIZED AUDIT LOGS
# =======================================================================

@cached("audit_logs", "admin_pagination")
async def _get_optimized_audit_logs(
    page: int = 1,
    per_page: int = 20,
    action_type: Optional[str] = None,
    target_entity_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
) -> Dict[str, Any]:
    """Optimized audit logs with efficient indexing"""
    try:
        async with profiler_manager.profile_operation("audit_logs_query"):
            admin_client = await create_supabase_admin_client()
            
            # Use optimized query with proper indexes
            query = admin_client.table('audit_logs').select(
                'id, action_by_user_id, action_timestamp, action_type, '
                'target_entity_type, target_entity_id, justification, details, '
                'ip_address, user_agent'
            )
            
            # Apply filters (indexes will be used)
            if action_type:
                query = query.eq('action_type', action_type)
            
            if target_entity_type:
                query = query.eq('target_entity_type', target_entity_type)
            
            if date_from:
                query = query.gte('action_timestamp', date_from)
            
            if date_to:
                query = query.lte('action_timestamp', date_to)
            
            # Apply pagination with efficient ordering (uses index)
            skip = (page - 1) * per_page
            query = query.order('action_timestamp', desc=True).range(skip, skip + per_page - 1)
            
            result = await query.execute()
            logs_data = result.data or []
            
            # Enrich with admin info efficiently
            if logs_data:
                admin_ids = list(set(log['action_by_user_id'] for log in logs_data))
                admin_info_query = admin_client.table('profiles').select(
                    'id, full_name, email'
                ).in_('id', admin_ids)
                
                admin_info_result = await admin_info_query.execute()
                admin_info_map = {
                    admin['id']: admin for admin in (admin_info_result.data or [])
                }
                
                # Enrich logs with admin info
                for log in logs_data:
                    admin_info = admin_info_map.get(log['action_by_user_id'], {})
                    log['admin_name'] = admin_info.get('full_name')
                    log['admin_email'] = admin_info.get('email')
            
            await admin_client.close()
            
            return {
                'logs': logs_data,
                'total': len(logs_data),
                'page': page,
                'per_page': per_page
            }
    
    except Exception as e:
        logger.error(f"Error in optimized audit logs: {e}")
        raise


@router.get("/admin/audit-logs/optimized")
async def get_audit_logs_optimized(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    action_type: Optional[str] = Query(None),
    target_entity_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    admin_user_id: str = Depends(require_global_admin)
):
    """Get optimized audit logs with caching and filtering"""
    try:
        with profiler_manager.profile_operation("audit_logs_endpoint"):
            result = await _get_optimized_audit_logs(
                page, per_page, action_type, target_entity_type, date_from, date_to
            )
            return result
    
    except Exception as e:
        logger.error(f"Error getting optimized audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve audit logs")


# =======================================================================
# CACHE MANAGEMENT ENDPOINTS
# =======================================================================

@router.post("/admin/cache/invalidate")
async def invalidate_admin_cache(
    cache_types: List[str] = Query(..., description="Cache types to invalidate"),
    admin_user_id: str = Depends(require_global_admin)
):
    """Invalidate specific admin cache types"""
    try:
        invalidated_count = 0
        
        for cache_type in cache_types:
            await cache_manager.invalidate(cache_type)
            invalidated_count += 1
        
        logger.info(f"Admin {admin_user_id} invalidated {invalidated_count} cache types")
        
        return {
            "message": f"Successfully invalidated {invalidated_count} cache types",
            "cache_types": cache_types
        }
    
    except Exception as e:
        logger.error(f"Error invalidating admin cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to invalidate cache")


@router.get("/admin/performance/dashboard")
async def get_admin_performance_dashboard(
    admin_user_id: str = Depends(require_global_admin)
):
    """Get comprehensive performance dashboard for admin"""
    try:
        # Import the performance dashboard function
        from middleware.performance_middleware import get_performance_dashboard_data
        
        dashboard_data = await get_performance_dashboard_data()
        
        # Add cache-specific metrics
        cache_stats = await cache_manager.get_stats()
        dashboard_data["cache_performance"] = cache_stats
        
        return dashboard_data
    
    except Exception as e:
        logger.error(f"Error getting performance dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve performance dashboard")


# =======================================================================
# BATCH OPERATIONS FOR PERFORMANCE
# =======================================================================

@router.post("/admin/batch/refresh-materialized-views")
async def refresh_materialized_views_admin(
    admin_user_id: str = Depends(require_global_admin)
):
    """Refresh all materialized views for better performance"""
    try:
        admin_client = await create_supabase_admin_client()
        
        # Refresh all materialized views
        result = await admin_client.rpc('refresh_analytics_materialized_views').execute()
        
        await admin_client.close()
        
        # Invalidate related caches
        await asyncio.gather(
            cache_manager.invalidate("analytics"),
            cache_manager.invalidate("author_data"),
            cache_manager.invalidate("admin_stats"),
            return_exceptions=True
        )
        
        logger.info(f"Admin {admin_user_id} refreshed materialized views")
        
        return {
            "message": "Materialized views refreshed successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error refreshing materialized views: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh materialized views") 