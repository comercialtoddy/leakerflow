"""
Rate Limiting Utility for Leaker-Flow FastAPI Application
Provides Redis-based rate limiting with different configurations for different endpoint types.
"""

import time
from typing import Optional, Dict, Any
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from enum import Enum
import redis.asyncio as redis
from utils.logger import logger
import hashlib
import json


class RateLimitTier(Enum):
    """Rate limiting tiers with different restrictions"""
    ADMIN_ACTIONS = "admin_actions"          # 10/min per IP - Most restrictive
    APPLICATION_SUBMISSION = "app_submission" # 3/day, 1/hour per IP  
    BILLING_OPERATIONS = "billing"           # 5/min per IP
    EMAIL_SERVICES = "email"                 # 10/hour per IP
    CONTENT_OPERATIONS = "content"           # 20/min per IP
    GENERAL_AUTH = "general_auth"            # 15/min per IP
    

class RateLimitConfig:
    """Configuration for rate limiting"""
    def __init__(
        self,
        requests_per_minute: Optional[int] = None,
        requests_per_hour: Optional[int] = None,
        requests_per_day: Optional[int] = None,
        burst_limit: Optional[int] = None
    ):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour  
        self.requests_per_day = requests_per_day
        self.burst_limit = burst_limit or requests_per_minute


# Rate limit configurations for different tiers
RATE_LIMIT_CONFIGS = {
    RateLimitTier.ADMIN_ACTIONS: RateLimitConfig(
        requests_per_minute=10,
        requests_per_hour=50,
        burst_limit=5
    ),
    RateLimitTier.APPLICATION_SUBMISSION: RateLimitConfig(
        requests_per_hour=1,
        requests_per_day=3,
        burst_limit=1
    ),
    RateLimitTier.BILLING_OPERATIONS: RateLimitConfig(
        requests_per_minute=5,
        burst_limit=3
    ),
    RateLimitTier.EMAIL_SERVICES: RateLimitConfig(
        requests_per_hour=10,
        burst_limit=2
    ),
    RateLimitTier.CONTENT_OPERATIONS: RateLimitConfig(
        requests_per_minute=20,
        burst_limit=10
    ),
    RateLimitTier.GENERAL_AUTH: RateLimitConfig(
        requests_per_minute=15,
        burst_limit=8
    )
}


class RateLimiter:
    """Redis-based rate limiter with sliding window implementation"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client
        self._local_fallback = {}  # Fallback when Redis is unavailable
        
    async def initialize(self):
        """Initialize Redis connection if not provided"""
        if not self.redis_client:
            try:
                from services import redis as redis_service
                self.redis_client = redis_service.get_client()
                if not self.redis_client:
                    logger.warning("Redis client not available, using local fallback for rate limiting")
            except Exception as e:
                logger.warning(f"Failed to initialize Redis for rate limiting: {e}")
    
    def _get_key(self, identifier: str, tier: RateLimitTier, window: str) -> str:
        """Generate Redis key for rate limiting"""
        return f"rate_limit:{tier.value}:{identifier}:{window}"
    
    def _get_client_identifier(self, request: Request) -> str:
        """Get client identifier (IP address with optional user ID)"""
        # Get IP from X-Forwarded-For header or direct client IP
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        # Could extend this to include user ID for authenticated requests
        return client_ip
    
    async def _check_redis_limit(
        self, 
        identifier: str, 
        config: RateLimitConfig, 
        tier: RateLimitTier
    ) -> Dict[str, Any]:
        """Check rate limit using Redis sliding window"""
        current_time = int(time.time())
        results = {}
        
        try:
            # Check each time window
            if config.requests_per_minute:
                key = self._get_key(identifier, tier, f"min:{current_time // 60}")
                count = await self.redis_client.incr(key)
                if count == 1:
                    await self.redis_client.expire(key, 60)
                
                results['minute'] = {
                    'count': count,
                    'limit': config.requests_per_minute,
                    'exceeded': count > config.requests_per_minute,
                    'reset_time': (current_time // 60 + 1) * 60
                }
            
            if config.requests_per_hour:
                key = self._get_key(identifier, tier, f"hour:{current_time // 3600}")
                count = await self.redis_client.incr(key)
                if count == 1:
                    await self.redis_client.expire(key, 3600)
                
                results['hour'] = {
                    'count': count,
                    'limit': config.requests_per_hour,
                    'exceeded': count > config.requests_per_hour,
                    'reset_time': (current_time // 3600 + 1) * 3600
                }
            
            if config.requests_per_day:
                key = self._get_key(identifier, tier, f"day:{current_time // 86400}")
                count = await self.redis_client.incr(key)
                if count == 1:
                    await self.redis_client.expire(key, 86400)
                
                results['day'] = {
                    'count': count,
                    'limit': config.requests_per_day,
                    'exceeded': count > config.requests_per_day,
                    'reset_time': (current_time // 86400 + 1) * 86400
                }
                
        except Exception as e:
            logger.error(f"Redis rate limiting error: {e}")
            # Fall back to local in-memory limiting
            return self._check_local_fallback(identifier, config, tier)
        
        return results
    
    def _check_local_fallback(
        self, 
        identifier: str, 
        config: RateLimitConfig, 
        tier: RateLimitTier
    ) -> Dict[str, Any]:
        """Fallback rate limiting using local memory (less accurate but functional)"""
        current_time = int(time.time())
        
        if identifier not in self._local_fallback:
            self._local_fallback[identifier] = {}
        
        results = {}
        client_data = self._local_fallback[identifier]
        
        # Simple minute-based limiting for fallback
        if config.requests_per_minute:
            minute_key = f"{tier.value}_min_{current_time // 60}"
            if minute_key not in client_data:
                # Clean old entries
                old_keys = [k for k in client_data.keys() if k.startswith(f"{tier.value}_min_") and int(k.split('_')[-1]) < current_time // 60]
                for old_key in old_keys:
                    del client_data[old_key]
                client_data[minute_key] = 0
            
            client_data[minute_key] += 1
            results['minute'] = {
                'count': client_data[minute_key],
                'limit': config.requests_per_minute,
                'exceeded': client_data[minute_key] > config.requests_per_minute,
                'reset_time': (current_time // 60 + 1) * 60
            }
        
        return results
    
    async def check_rate_limit(
        self, 
        request: Request, 
        tier: RateLimitTier
    ) -> Optional[Dict[str, Any]]:
        """
        Check if request should be rate limited
        Returns None if allowed, or limit info if exceeded
        """
        config = RATE_LIMIT_CONFIGS.get(tier)
        if not config:
            logger.warning(f"No rate limit config found for tier {tier}")
            return None
        
        identifier = self._get_client_identifier(request)
        
        # Initialize Redis if needed
        if not self.redis_client:
            await self.initialize()
        
        # Check limits
        if self.redis_client:
            results = await self._check_redis_limit(identifier, config, tier)
        else:
            results = self._check_local_fallback(identifier, config, tier)
        
        # Find the most restrictive exceeded limit
        for window, data in results.items():
            if data['exceeded']:
                logger.warning(
                    f"Rate limit exceeded for {identifier} on tier {tier.value}: "
                    f"{data['count']}/{data['limit']} {window}"
                )
                return {
                    'exceeded': True,
                    'window': window,
                    'count': data['count'],
                    'limit': data['limit'],
                    'reset_time': data['reset_time'],
                    'retry_after': data['reset_time'] - int(time.time())
                }
        
        return None


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


async def get_rate_limiter() -> RateLimiter:
    """Get or create the global rate limiter instance"""
    global _rate_limiter
    if not _rate_limiter:
        _rate_limiter = RateLimiter()
        await _rate_limiter.initialize()
    return _rate_limiter


def create_rate_limit_dependency(tier: RateLimitTier):
    """Create a FastAPI dependency for rate limiting"""
    async def rate_limit_dependency(request: Request):
        limiter = await get_rate_limiter()
        limit_info = await limiter.check_rate_limit(request, tier)
        
        if limit_info:
            # Rate limit exceeded
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Try again in {limit_info['retry_after']} seconds.",
                    "retry_after": limit_info['retry_after'],
                    "limit": limit_info['limit'],
                    "window": limit_info['window']
                },
                headers={"Retry-After": str(limit_info['retry_after'])}
            )
        
        return True
    
    return rate_limit_dependency


# Pre-defined dependencies for common use cases
admin_rate_limit = create_rate_limit_dependency(RateLimitTier.ADMIN_ACTIONS)
application_rate_limit = create_rate_limit_dependency(RateLimitTier.APPLICATION_SUBMISSION)
billing_rate_limit = create_rate_limit_dependency(RateLimitTier.BILLING_OPERATIONS)
email_rate_limit = create_rate_limit_dependency(RateLimitTier.EMAIL_SERVICES)
content_rate_limit = create_rate_limit_dependency(RateLimitTier.CONTENT_OPERATIONS)
auth_rate_limit = create_rate_limit_dependency(RateLimitTier.GENERAL_AUTH) 