"""
Performance Middleware for FastAPI Backend Optimization
Provides automatic performance monitoring, response optimization, and caching integration.
"""

import time
import json
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from utils.logger import logger
from utils.cache import cache_manager
from utils.performance_profiling import profiler_manager


class PerformanceMetrics:
    """Tracks performance metrics for endpoints"""
    
    def __init__(self):
        self.metrics = {}
        self.slow_queries = []
        self.error_counts = {}
    
    def record_request(self, endpoint: str, method: str, duration: float, 
                      status_code: int, cache_hit: bool = False):
        """Record request metrics"""
        key = f"{method}:{endpoint}"
        
        if key not in self.metrics:
            self.metrics[key] = {
                "total_requests": 0,
                "total_duration": 0.0,
                "avg_duration": 0.0,
                "min_duration": float('inf'),
                "max_duration": 0.0,
                "cache_hits": 0,
                "error_count": 0,
                "last_called": None
            }
        
        metrics = self.metrics[key]
        metrics["total_requests"] += 1
        metrics["total_duration"] += duration
        metrics["avg_duration"] = metrics["total_duration"] / metrics["total_requests"]
        metrics["min_duration"] = min(metrics["min_duration"], duration)
        metrics["max_duration"] = max(metrics["max_duration"], duration)
        metrics["last_called"] = datetime.utcnow().isoformat()
        
        if cache_hit:
            metrics["cache_hits"] += 1
        
        if status_code >= 400:
            metrics["error_count"] += 1
        
        # Track slow queries (>2 seconds)
        if duration > 2.0:
            self.slow_queries.append({
                "endpoint": endpoint,
                "method": method,
                "duration": duration,
                "timestamp": datetime.utcnow().isoformat(),
                "status_code": status_code
            })
            
            # Keep only last 100 slow queries
            if len(self.slow_queries) > 100:
                self.slow_queries = self.slow_queries[-100:]
    
    def get_summary(self) -> Dict[str, Any]:
        """Get performance summary"""
        total_requests = sum(m["total_requests"] for m in self.metrics.values())
        total_cache_hits = sum(m["cache_hits"] for m in self.metrics.values())
        cache_hit_rate = (total_cache_hits / total_requests * 100) if total_requests > 0 else 0
        
        # Find slowest endpoints
        slowest_endpoints = sorted(
            [(endpoint, metrics["avg_duration"]) for endpoint, metrics in self.metrics.items()],
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return {
            "total_requests": total_requests,
            "cache_hit_rate": round(cache_hit_rate, 2),
            "slow_queries_count": len(self.slow_queries),
            "slowest_endpoints": [
                {"endpoint": ep, "avg_duration_ms": round(dur * 1000, 2)}
                for ep, dur in slowest_endpoints
            ],
            "recent_slow_queries": self.slow_queries[-10:] if self.slow_queries else []
        }


# Global performance metrics instance
performance_metrics = PerformanceMetrics()


class PerformanceMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for performance optimization"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.cache_enabled_endpoints = {
            "/api/admin/articles",
            "/api/admin/authors", 
            "/api/admin/applications",
            "/api/admin/analytics",
            "/api/admin/audit-logs",
            "/api/admin/statistics"
        }
    
    async def dispatch(self, request: Request, call_next):
        """Process request with performance monitoring and optimization"""
        start_time = time.time()
        endpoint = request.url.path
        method = request.method
        
        # Add request ID for tracing
        request_id = f"req_{int(time.time() * 1000)}"
        request.state.request_id = request_id
        
        # Check cache for GET requests on cacheable endpoints
        cache_hit = False
        cached_response = None
        
        if method == "GET" and endpoint in self.cache_enabled_endpoints:
            cached_response = await self._try_cache_get(request)
            if cached_response:
                cache_hit = True
        
        if cached_response:
            response = cached_response
        else:
            # Process request normally
            try:
                response = await call_next(request)
                
                # Cache successful GET responses
                if (method == "GET" and 
                    endpoint in self.cache_enabled_endpoints and 
                    response.status_code == 200):
                    await self._try_cache_set(request, response)
                
            except Exception as e:
                logger.error(f"Request {request_id} failed: {str(e)}")
                response = JSONResponse(
                    status_code=500,
                    content={"error": "Internal server error", "request_id": request_id}
                )
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Add performance headers
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Cache-Status"] = "HIT" if cache_hit else "MISS"
        
        # Record metrics
        performance_metrics.record_request(
            endpoint, method, duration, response.status_code, cache_hit
        )
        
        # Log slow requests
        if duration > 1.0:  # Log requests slower than 1 second
            logger.warning(
                f"Slow request: {method} {endpoint} took {duration:.3f}s "
                f"(Status: {response.status_code}, Cache: {'HIT' if cache_hit else 'MISS'})"
            )
        
        return response
    
    async def _try_cache_get(self, request: Request) -> Optional[Response]:
        """Try to get response from cache"""
        try:
            cache_key = self._generate_cache_key(request)
            cache_type = self._determine_cache_type(request.url.path)
            
            cached_data = await cache_manager.get(cache_type, cache_key)
            if cached_data:
                return JSONResponse(content=cached_data)
        
        except Exception as e:
            logger.error(f"Cache get error: {e}")
        
        return None
    
    async def _try_cache_set(self, request: Request, response: Response):
        """Try to cache response"""
        try:
            if hasattr(response, 'body'):
                cache_key = self._generate_cache_key(request)
                cache_type = self._determine_cache_type(request.url.path)
                
                # Parse response body
                response_data = json.loads(response.body.decode())
                
                await cache_manager.set(cache_type, response_data, cache_key)
        
        except Exception as e:
            logger.error(f"Cache set error: {e}")
    
    def _generate_cache_key(self, request: Request) -> str:
        """Generate cache key for request"""
        # Include query parameters in cache key
        query_params = dict(request.query_params)
        sorted_params = sorted(query_params.items())
        
        key_parts = [request.url.path]
        for param, value in sorted_params:
            key_parts.append(f"{param}:{value}")
        
        return ":".join(key_parts)
    
    def _determine_cache_type(self, path: str) -> str:
        """Determine cache type based on endpoint path"""
        if "/articles" in path:
            return "article_lists"
        elif "/authors" in path:
            return "author_data"
        elif "/applications" in path:
            return "application_lists"
        elif "/analytics" in path:
            return "analytics"
        elif "/audit-logs" in path:
            return "audit_logs"
        elif "/statistics" in path:
            return "admin_stats"
        else:
            return "article_lists"  # Default


class ResponseOptimizer:
    """Optimizes API responses for better performance"""
    
    @staticmethod
    def compress_response_data(data: Any, max_content_length: int = 200) -> Any:
        """Compress response data by removing or truncating large fields"""
        if isinstance(data, dict):
            optimized = {}
            for key, value in data.items():
                if key == "content" and isinstance(value, str) and len(value) > max_content_length:
                    optimized[f"{key}_preview"] = value[:max_content_length] + "..."
                    optimized[f"{key}_length"] = len(value)
                elif isinstance(value, (dict, list)):
                    optimized[key] = ResponseOptimizer.compress_response_data(value, max_content_length)
                else:
                    optimized[key] = value
            return optimized
        
        elif isinstance(data, list):
            return [ResponseOptimizer.compress_response_data(item, max_content_length) for item in data]
        
        return data
    
    @staticmethod
    def paginate_response(data: List[Any], page: int = 1, per_page: int = 20) -> Dict[str, Any]:
        """Add pagination to response data"""
        total_items = len(data)
        total_pages = (total_items + per_page - 1) // per_page
        
        start_index = (page - 1) * per_page
        end_index = start_index + per_page
        
        paginated_data = data[start_index:end_index]
        
        return {
            "data": paginated_data,
            "pagination": {
                "current_page": page,
                "per_page": per_page,
                "total_items": total_items,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }


# Global response optimizer instance
response_optimizer = ResponseOptimizer()


class AsyncTaskManager:
    """Manages background async tasks for performance optimization"""
    
    def __init__(self):
        self.background_tasks = []
        self.task_results = {}
    
    async def schedule_cache_warmup(self, endpoints: List[str]):
        """Schedule cache warmup for frequently accessed endpoints"""
        for endpoint in endpoints:
            task = asyncio.create_task(self._warmup_endpoint_cache(endpoint))
            self.background_tasks.append(task)
    
    async def _warmup_endpoint_cache(self, endpoint: str):
        """Warm up cache for specific endpoint"""
        try:
            # This would typically make a request to the endpoint
            # For now, just log the warming attempt
            logger.info(f"Cache warmup scheduled for endpoint: {endpoint}")
            
            # Simulate cache warming delay
            await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Cache warmup failed for {endpoint}: {e}")
    
    async def schedule_performance_analysis(self):
        """Schedule background performance analysis"""
        task = asyncio.create_task(self._analyze_performance_patterns())
        self.background_tasks.append(task)
    
    async def _analyze_performance_patterns(self):
        """Analyze performance patterns and suggest optimizations"""
        try:
            metrics_summary = performance_metrics.get_summary()
            
            # Identify endpoints that need optimization
            slow_endpoints = [
                ep for ep in metrics_summary["slowest_endpoints"] 
                if ep["avg_duration_ms"] > 1000  # Slower than 1 second
            ]
            
            if slow_endpoints:
                logger.warning(
                    f"Performance analysis: {len(slow_endpoints)} slow endpoints detected. "
                    f"Consider optimization for: {[ep['endpoint'] for ep in slow_endpoints[:3]]}"
                )
            
            # Check cache effectiveness
            if metrics_summary["cache_hit_rate"] < 50:
                logger.warning(
                    f"Low cache hit rate: {metrics_summary['cache_hit_rate']}%. "
                    "Consider adjusting cache strategies."
                )
        
        except Exception as e:
            logger.error(f"Performance analysis failed: {e}")
    
    async def cleanup_completed_tasks(self):
        """Clean up completed background tasks"""
        self.background_tasks = [task for task in self.background_tasks if not task.done()]


# Global async task manager
async_task_manager = AsyncTaskManager()


# Utility functions for middleware integration
async def initialize_performance_middleware():
    """Initialize performance middleware components"""
    try:
        await cache_manager.initialize()
        logger.info("Performance middleware initialized successfully")
    except Exception as e:
        logger.error(f"Performance middleware initialization failed: {e}")


async def get_performance_dashboard_data() -> Dict[str, Any]:
    """Get comprehensive performance dashboard data"""
    try:
        # Get performance metrics
        metrics_summary = performance_metrics.get_summary()
        
        # Get cache metrics
        cache_metrics = await cache_manager.get_stats()
        
        # Get profiler data if available
        profiler_data = {}
        try:
            profiler_data = await profiler_manager.get_performance_summary()
        except Exception:
            pass
        
        return {
            "performance_metrics": metrics_summary,
            "cache_metrics": cache_metrics,
            "profiler_data": profiler_data,
            "optimization_suggestions": _generate_optimization_suggestions(metrics_summary)
        }
    
    except Exception as e:
        logger.error(f"Failed to get performance dashboard data: {e}")
        return {"error": "Failed to retrieve performance data"}


def _generate_optimization_suggestions(metrics: Dict[str, Any]) -> List[str]:
    """Generate optimization suggestions based on metrics"""
    suggestions = []
    
    # Check cache hit rate
    if metrics["cache_hit_rate"] < 60:
        suggestions.append(
            f"Cache hit rate is {metrics['cache_hit_rate']}%. "
            "Consider increasing cache TTL or optimizing cache keys."
        )
    
    # Check slow queries
    if metrics["slow_queries_count"] > 10:
        suggestions.append(
            f"{metrics['slow_queries_count']} slow queries detected. "
            "Review database indexes and query optimization."
        )
    
    # Check slow endpoints
    slow_endpoints = [ep for ep in metrics["slowest_endpoints"] if ep["avg_duration_ms"] > 1000]
    if slow_endpoints:
        suggestions.append(
            f"{len(slow_endpoints)} endpoints averaging >1s response time. "
            f"Focus on optimizing: {', '.join([ep['endpoint'] for ep in slow_endpoints[:3]])}"
        )
    
    if not suggestions:
        suggestions.append("Performance looks good! Keep monitoring for continued optimization.")
    
    return suggestions 