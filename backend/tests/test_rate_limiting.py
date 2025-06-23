"""
Test Rate Limiting Functionality
Tests for utils.rate_limiting module and endpoint protection
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import Request, HTTPException
from utils.rate_limiting import (
    RateLimitTier,
    RateLimitConfig,
    RateLimiter,
    RATE_LIMIT_CONFIGS,
    create_rate_limit_dependency,
    admin_rate_limit,
    application_rate_limit
)


class TestRateLimitConfig:
    """Test rate limit configuration"""
    
    def test_rate_limit_config_creation(self):
        """Test creating rate limit configuration"""
        config = RateLimitConfig(
            requests_per_minute=10,
            requests_per_hour=100,
            requests_per_day=1000,
            burst_limit=5
        )
        
        assert config.requests_per_minute == 10
        assert config.requests_per_hour == 100
        assert config.requests_per_day == 1000
        assert config.burst_limit == 5
    
    def test_rate_limit_config_defaults(self):
        """Test default burst limit"""
        config = RateLimitConfig(requests_per_minute=10)
        assert config.burst_limit == 10  # Should default to requests_per_minute
    
    def test_all_tier_configs_exist(self):
        """Test that all tiers have configurations"""
        for tier in RateLimitTier:
            assert tier in RATE_LIMIT_CONFIGS
            config = RATE_LIMIT_CONFIGS[tier]
            assert isinstance(config, RateLimitConfig)


class TestRateLimiter:
    """Test the RateLimiter class"""
    
    @pytest.fixture
    def mock_request(self):
        """Create a mock FastAPI Request"""
        request = MagicMock()
        request.client.host = "192.168.1.100"
        request.headers = {}
        return request
    
    @pytest.fixture
    def rate_limiter(self):
        """Create a RateLimiter instance with mock Redis"""
        limiter = RateLimiter()
        limiter.redis_client = None  # Force local fallback
        return limiter
    
    def test_get_client_identifier_basic_ip(self, rate_limiter, mock_request):
        """Test client identification from basic IP"""
        identifier = rate_limiter._get_client_identifier(mock_request)
        assert identifier == "192.168.1.100"
    
    def test_get_client_identifier_forwarded_for(self, rate_limiter, mock_request):
        """Test client identification from X-Forwarded-For header"""
        mock_request.headers = {"X-Forwarded-For": "203.0.113.195, 192.168.1.100"}
        identifier = rate_limiter._get_client_identifier(mock_request)
        assert identifier == "203.0.113.195"
    
    def test_get_client_identifier_no_client(self, rate_limiter):
        """Test client identification when no client info available"""
        request = MagicMock()
        request.client = None
        request.headers = {}
        identifier = rate_limiter._get_client_identifier(request)
        assert identifier == "unknown"
    
    def test_local_fallback_rate_limiting(self, rate_limiter, mock_request):
        """Test local fallback rate limiting functionality"""
        config = RateLimitConfig(requests_per_minute=2)
        
        # First request - should pass
        result1 = rate_limiter._check_local_fallback("test_ip", config, RateLimitTier.ADMIN_ACTIONS)
        assert not result1['minute']['exceeded']
        assert result1['minute']['count'] == 1
        
        # Second request - should pass
        result2 = rate_limiter._check_local_fallback("test_ip", config, RateLimitTier.ADMIN_ACTIONS)
        assert not result2['minute']['exceeded']
        assert result2['minute']['count'] == 2
        
        # Third request - should be limited
        result3 = rate_limiter._check_local_fallback("test_ip", config, RateLimitTier.ADMIN_ACTIONS)
        assert result3['minute']['exceeded']
        assert result3['minute']['count'] == 3
    
    @pytest.mark.asyncio
    async def test_check_rate_limit_no_exceed(self, rate_limiter, mock_request):
        """Test rate limit check when limit is not exceeded"""
        result = await rate_limiter.check_rate_limit(mock_request, RateLimitTier.ADMIN_ACTIONS)
        assert result is None  # No limit exceeded
    
    @pytest.mark.asyncio
    async def test_check_rate_limit_with_exceed(self, rate_limiter, mock_request):
        """Test rate limit check when limit is exceeded"""
        # Simulate multiple requests to exceed the limit
        config = RATE_LIMIT_CONFIGS[RateLimitTier.ADMIN_ACTIONS]
        
        # Make requests up to the limit
        for i in range(config.requests_per_minute + 1):
            result = await rate_limiter.check_rate_limit(mock_request, RateLimitTier.ADMIN_ACTIONS)
            if i < config.requests_per_minute:
                assert result is None
            else:
                # Should be rate limited
                assert result is not None
                assert result['exceeded'] is True
                assert 'retry_after' in result
                break


class TestRateLimitDependencies:
    """Test FastAPI dependency functions"""
    
    @pytest.fixture
    def mock_request(self):
        """Create a mock FastAPI Request"""
        request = MagicMock()
        request.client.host = "192.168.1.100"
        request.headers = {}
        return request
    
    @pytest.mark.asyncio
    async def test_dependency_creation(self):
        """Test creating a rate limit dependency"""
        dependency = create_rate_limit_dependency(RateLimitTier.ADMIN_ACTIONS)
        assert callable(dependency)
    
    @pytest.mark.asyncio
    async def test_dependency_passes_when_under_limit(self, mock_request):
        """Test dependency passes when under rate limit"""
        with patch('utils.rate_limiting.get_rate_limiter') as mock_get_limiter:
            mock_limiter = AsyncMock()
            mock_limiter.check_rate_limit.return_value = None  # No limit exceeded
            mock_get_limiter.return_value = mock_limiter
            
            dependency = create_rate_limit_dependency(RateLimitTier.ADMIN_ACTIONS)
            result = await dependency(mock_request)
            assert result is True
    
    @pytest.mark.asyncio
    async def test_dependency_raises_when_over_limit(self, mock_request):
        """Test dependency raises HTTPException when over rate limit"""
        with patch('utils.rate_limiting.get_rate_limiter') as mock_get_limiter:
            mock_limiter = AsyncMock()
            mock_limiter.check_rate_limit.return_value = {
                'exceeded': True,
                'window': 'minute',
                'count': 15,
                'limit': 10,
                'reset_time': int(time.time()) + 60,
                'retry_after': 60
            }
            mock_get_limiter.return_value = mock_limiter
            
            dependency = create_rate_limit_dependency(RateLimitTier.ADMIN_ACTIONS)
            
            with pytest.raises(HTTPException) as exc_info:
                await dependency(mock_request)
            
            assert exc_info.value.status_code == 429
            assert "Rate limit exceeded" in exc_info.value.detail["error"]
            assert exc_info.value.headers["Retry-After"] == "60"


class TestIntegration:
    """Integration tests for rate limiting with different tiers"""
    
    @pytest.mark.asyncio
    async def test_admin_actions_rate_limit(self):
        """Test admin actions have strict rate limiting"""
        config = RATE_LIMIT_CONFIGS[RateLimitTier.ADMIN_ACTIONS]
        assert config.requests_per_minute == 10
        assert config.requests_per_hour == 50
    
    @pytest.mark.asyncio
    async def test_application_submission_rate_limit(self):
        """Test application submission has very strict rate limiting"""
        config = RATE_LIMIT_CONFIGS[RateLimitTier.APPLICATION_SUBMISSION]
        assert config.requests_per_hour == 1
        assert config.requests_per_day == 3
    
    @pytest.mark.asyncio
    async def test_different_ips_separate_limits(self):
        """Test that different IPs have separate rate limits"""
        limiter = RateLimiter()
        limiter.redis_client = None  # Use local fallback
        
        # Create requests from different IPs
        request1 = MagicMock()
        request1.client.host = "192.168.1.100"
        request1.headers = {}
        
        request2 = MagicMock()
        request2.client.host = "192.168.1.101"
        request2.headers = {}
        
        config = RateLimitConfig(requests_per_minute=1)
        
        # Both IPs should be able to make one request
        result1 = await limiter.check_rate_limit(request1, RateLimitTier.ADMIN_ACTIONS)
        assert result1 is None
        
        result2 = await limiter.check_rate_limit(request2, RateLimitTier.ADMIN_ACTIONS)
        assert result2 is None
    
    @pytest.mark.asyncio
    async def test_redis_fallback_behavior(self):
        """Test behavior when Redis is unavailable"""
        limiter = RateLimiter()
        
        # Mock Redis to raise an exception
        mock_redis = AsyncMock()
        mock_redis.incr.side_effect = Exception("Redis connection failed")
        limiter.redis_client = mock_redis
        
        request = MagicMock()
        request.client.host = "192.168.1.100"
        request.headers = {}
        
        # Should fall back to local limiting without raising exception
        result = await limiter.check_rate_limit(request, RateLimitTier.ADMIN_ACTIONS)
        assert result is None  # First request should pass


class TestRateLimitTierConfigurations:
    """Test specific configurations for each tier"""
    
    def test_admin_actions_config(self):
        """Test admin actions have the most restrictive limits"""
        config = RATE_LIMIT_CONFIGS[RateLimitTier.ADMIN_ACTIONS]
        assert config.requests_per_minute == 10
        assert config.requests_per_hour == 50
        assert config.burst_limit == 5
    
    def test_application_submission_config(self):
        """Test application submission is very restrictive for long-term abuse prevention"""
        config = RATE_LIMIT_CONFIGS[RateLimitTier.APPLICATION_SUBMISSION]
        assert config.requests_per_hour == 1
        assert config.requests_per_day == 3
        assert config.burst_limit == 1
    
    def test_billing_operations_config(self):
        """Test billing operations have moderate restrictions"""
        config = RATE_LIMIT_CONFIGS[RateLimitTier.BILLING_OPERATIONS]
        assert config.requests_per_minute == 5
        assert config.burst_limit == 3
    
    def test_email_services_config(self):
        """Test email services are limited by hour to prevent spam"""
        config = RATE_LIMIT_CONFIGS[RateLimitTier.EMAIL_SERVICES]
        assert config.requests_per_hour == 10
        assert config.burst_limit == 2
    
    def test_content_operations_config(self):
        """Test content operations allow higher throughput"""
        config = RATE_LIMIT_CONFIGS[RateLimitTier.CONTENT_OPERATIONS]
        assert config.requests_per_minute == 20
        assert config.burst_limit == 10
    
    def test_general_auth_config(self):
        """Test general auth operations have balanced limits"""
        config = RATE_LIMIT_CONFIGS[RateLimitTier.GENERAL_AUTH]
        assert config.requests_per_minute == 15
        assert config.burst_limit == 8


@pytest.mark.asyncio
async def test_predefined_dependencies():
    """Test that predefined dependencies are properly configured"""
    assert callable(admin_rate_limit)
    assert callable(application_rate_limit)
    
    # Test that they're configured for the right tiers
    # This is a bit of a hack since the tier is captured in closure
    # But we can test that they don't immediately error
    mock_request = MagicMock()
    mock_request.client.host = "192.168.1.100"
    mock_request.headers = {}
    
    with patch('utils.rate_limiting.get_rate_limiter') as mock_get_limiter:
        mock_limiter = AsyncMock()
        mock_limiter.check_rate_limit.return_value = None
        mock_get_limiter.return_value = mock_limiter
        
        # Should not raise exceptions
        result1 = await admin_rate_limit(mock_request)
        assert result1 is True
        
        result2 = await application_rate_limit(mock_request)
        assert result2 is True 