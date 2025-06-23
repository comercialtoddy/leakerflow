"""
Redis Caching System for Leaker-Flow Backend Performance Optimization
Provides intelligent caching strategies for admin dashboard and API endpoints.
"""

import json
import asyncio
from typing import Any, Optional, Dict, List, Callable, Union
from datetime import datetime, timedelta
from functools import wraps
from pydantic import BaseModel
from enum import Enum

from services import redis as redis_service
from utils.logger import logger
from utils.performance_profiling import profiler_manager


class CacheStrategy(str, Enum):
    """Cache strategies for different types of data"""
    AGGRESSIVE = "aggressive"      # Long TTL, frequent access (stats, configs)
    MODERATE = "moderate"          # Medium TTL, regular access (article lists)
    CONSERVATIVE = "conservative"   # Short TTL, dynamic data (user sessions)
    REAL_TIME = "real_time"        # Very short TTL, live data (active users)


class CacheConfig(BaseModel):
    """Configuration for cache strategies"""
    ttl_seconds: int
    strategy: CacheStrategy
    compression: bool = False
    invalidation_pattern: Optional[str] = None


# Cache configurations for different data types
CACHE_CONFIGS = {
    # Admin dashboard statistics - rarely change
    "admin_stats": CacheConfig(
        ttl_seconds=300,  # 5 minutes
        strategy=CacheStrategy.AGGRESSIVE,
        invalidation_pattern="admin:stats:*"
    ),
    
    # Article lists and filters - moderate caching
    "article_lists": CacheConfig(
        ttl_seconds=180,  # 3 minutes
        strategy=CacheStrategy.MODERATE,
        invalidation_pattern="articles:list:*"
    ),
    
    # Author performance data - cached but needs refresh
    "author_data": CacheConfig(
        ttl_seconds=600,  # 10 minutes
        strategy=CacheStrategy.MODERATE,
        invalidation_pattern="authors:*"
    ),
    
    # Application lists - moderate refresh
    "application_lists": CacheConfig(
        ttl_seconds=120,  # 2 minutes
        strategy=CacheStrategy.MODERATE,
        invalidation_pattern="applications:*"
    ),
    
    # Analytics data - longer cache due to computation cost
    "analytics": CacheConfig(
        ttl_seconds=900,  # 15 minutes
        strategy=CacheStrategy.AGGRESSIVE,
        compression=True,
        invalidation_pattern="analytics:*"
    ),
    
    # Audit logs - conservative caching
    "audit_logs": CacheConfig(
        ttl_seconds=60,   # 1 minute
        strategy=CacheStrategy.CONSERVATIVE,
        invalidation_pattern="audit:*"
    ),
    
    # User sessions and real-time data
    "user_sessions": CacheConfig(
        ttl_seconds=30,   # 30 seconds
        strategy=CacheStrategy.REAL_TIME,
        invalidation_pattern="sessions:*"
    )
}


class CacheManager:
    """Redis cache manager with intelligent strategies"""
    
    def __init__(self):
        self.redis_client = None
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "invalidations": 0
        }
    
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = await redis_service.get_client()
            logger.info("Cache manager initialized with Redis")
        except Exception as e:
            logger.warning(f"Cache manager failed to initialize Redis: {e}")
            self.redis_client = None
    
    def _generate_cache_key(self, prefix: str, **kwargs) -> str:
        """Generate consistent cache key"""
        # Sort kwargs for consistent key generation
        sorted_kwargs = sorted(kwargs.items())
        key_parts = [prefix]
        
        for key, value in sorted_kwargs:
            if isinstance(value, (dict, list)):
                value = json.dumps(value, sort_keys=True)
            key_parts.append(f"{key}:{value}")
        
        return ":".join(key_parts)
    
    async def get(self, cache_type: str, key_suffix: str = "", **kwargs) -> Optional[Any]:
        """Get cached data"""
        if not self.redis_client:
            return None
        
        try:
            cache_key = self._generate_cache_key(f"cache:{cache_type}", 
                                                key_suffix=key_suffix, **kwargs)
            
            start_time = datetime.utcnow()
            result = await redis_service.get(cache_key)
            
            if result:
                self._stats["hits"] += 1
                logger.debug(f"Cache hit for {cache_key}")
                return json.loads(result)
            else:
                self._stats["misses"] += 1
                logger.debug(f"Cache miss for {cache_key}")
                return None
                
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    async def set(self, cache_type: str, data: Any, key_suffix: str = "", **kwargs):
        """Set cached data with appropriate TTL"""
        if not self.redis_client:
            return
        
        try:
            config = CACHE_CONFIGS.get(cache_type)
            if not config:
                logger.warning(f"No cache config found for type: {cache_type}")
                return
            
            cache_key = self._generate_cache_key(f"cache:{cache_type}", 
                                                key_suffix=key_suffix, **kwargs)
            
            # Serialize data
            serialized_data = json.dumps(data, default=str)
            
            # Set with TTL
            await redis_service.set(cache_key, serialized_data, ex=config.ttl_seconds)
            
            self._stats["sets"] += 1
            logger.debug(f"Cache set for {cache_key} (TTL: {config.ttl_seconds}s)")
            
        except Exception as e:
            logger.error(f"Cache set error: {e}")
    
    async def invalidate(self, cache_type: str, pattern: Optional[str] = None):
        """Invalidate cache entries"""
        if not self.redis_client:
            return
        
        try:
            config = CACHE_CONFIGS.get(cache_type)
            if not config:
                return
            
            # Use provided pattern or default from config
            invalidation_pattern = pattern or config.invalidation_pattern
            if not invalidation_pattern:
                return
            
            # Get all matching keys
            keys = await redis_service.keys(f"cache:{invalidation_pattern}")
            
            if keys:
                # Delete all matching keys
                for key in keys:
                    await redis_service.delete(key)
                
                self._stats["invalidations"] += len(keys)
                logger.info(f"Invalidated {len(keys)} cache entries for pattern: {invalidation_pattern}")
        
        except Exception as e:
            logger.error(f"Cache invalidation error: {e}")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self._stats["hits"] + self._stats["misses"]
        hit_rate = (self._stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "total_requests": total_requests,
            "hit_rate_percentage": round(hit_rate, 2),
            "hits": self._stats["hits"],
            "misses": self._stats["misses"],
            "sets": self._stats["sets"],
            "invalidations": self._stats["invalidations"]
        }


# Global cache manager instance
cache_manager = CacheManager()


def cached(cache_type: str, key_suffix: str = "", invalidate_on: Optional[List[str]] = None):
    """Decorator for caching function results"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function args
            cache_kwargs = {}
            if args:
                cache_kwargs["args"] = str(hash(str(args)))
            if kwargs:
                cache_kwargs["kwargs"] = str(hash(str(sorted(kwargs.items()))))
            
            # Try to get from cache first
            cached_result = await cache_manager.get(cache_type, key_suffix, **cache_kwargs)
            if cached_result is not None:
                return cached_result
            
            # Execute function if not cached
            start_time = datetime.utcnow()
            result = await func(*args, **kwargs)
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            # Cache the result
            await cache_manager.set(cache_type, result, key_suffix, **cache_kwargs)
            
            # Log performance
            logger.info(f"Function {func.__name__} executed in {execution_time:.3f}s and cached")
            
            return result
        
        return wrapper
    return decorator


class DataOptimizer:
    """Optimizes data serialization and transfer"""
    
    @staticmethod
    def optimize_article_data(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Optimize article data for API responses"""
        optimized = []
        
        for article in articles:
            # Remove unnecessary fields for list views
            optimized_article = {
                "id": article.get("id"),
                "title": article.get("title"),
                "subtitle": article.get("subtitle"),
                "status": article.get("status"),
                "visibility": article.get("visibility"),
                "category": article.get("category"),
                "created_at": article.get("created_at"),
                "updated_at": article.get("updated_at"),
                "total_views": article.get("total_views", 0),
                "vote_score": article.get("vote_score", 0),
                "trend_score": article.get("trend_score", 0.0),
                
                # Optimized author info (only essential fields)
                "author": {
                    "id": article.get("author", {}).get("id"),
                    "full_name": article.get("author", {}).get("full_name"),
                    "email": article.get("author", {}).get("email")
                } if article.get("author") else None,
                
                # Optimized account info
                "account": {
                    "id": article.get("account", {}).get("id"),
                    "name": article.get("account", {}).get("name"),
                    "slug": article.get("account", {}).get("slug")
                } if article.get("account") else None
            }
            
            # Only include content preview for admin listings
            if len(article.get("content", "")) > 200:
                optimized_article["content_preview"] = article.get("content", "")[:200] + "..."
            else:
                optimized_article["content_preview"] = article.get("content", "")
            
            optimized.append(optimized_article)
        
        return optimized
    
    @staticmethod
    def optimize_author_data(authors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Optimize author data for API responses"""
        optimized = []
        
        for author in authors:
            optimized_author = {
                "id": author.get("id"),
                "full_name": author.get("full_name"),
                "email": author.get("email"),
                "status": author.get("status", "active"),
                "articles_count": author.get("articles_count", 0),
                "total_views": author.get("total_views", 0),
                "total_votes": author.get("total_votes", 0),
                "average_votes": author.get("average_votes", 0.0),
                "last_published_date": author.get("last_published_date"),
                "last_active_date": author.get("last_active_date"),
                "created_at": author.get("created_at"),
                
                # Only include bio preview
                "bio_preview": (author.get("bio", "")[:100] + "...") 
                              if len(author.get("bio", "")) > 100 
                              else author.get("bio", "")
            }
            
            optimized.append(optimized_author)
        
        return optimized


# Global data optimizer instance
data_optimizer = DataOptimizer()


# Utility functions for cache invalidation triggers
async def invalidate_article_caches():
    """Invalidate all article-related caches"""
    await cache_manager.invalidate("article_lists")
    await cache_manager.invalidate("admin_stats")
    await cache_manager.invalidate("analytics")


async def invalidate_author_caches():
    """Invalidate all author-related caches"""
    await cache_manager.invalidate("author_data")
    await cache_manager.invalidate("admin_stats")


async def invalidate_application_caches():
    """Invalidate all application-related caches"""
    await cache_manager.invalidate("application_lists")
    await cache_manager.invalidate("admin_stats")


# Performance monitoring integration
async def get_cache_performance_metrics() -> Dict[str, Any]:
    """Get comprehensive cache performance metrics"""
    stats = await cache_manager.get_stats()
    
    return {
        "cache_performance": stats,
        "cache_configs": {
            cache_type: {
                "ttl_seconds": config.ttl_seconds,
                "strategy": config.strategy,
                "compression": config.compression
            }
            for cache_type, config in CACHE_CONFIGS.items()
        }
    } 