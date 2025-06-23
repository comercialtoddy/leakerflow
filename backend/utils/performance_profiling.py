#!/usr/bin/env python3
"""
Performance Profiling Utilities for Leaker-Flow
===============================================

This module provides comprehensive performance profiling tools across the entire
Leaker-Flow stack: React frontend, FastAPI backend, and Supabase PostgreSQL.

Key Features:
- FastAPI endpoint profiling with timing and resource usage
- Database query performance analysis
- Memory and CPU monitoring
- Performance metrics collection and reporting
- Integration with existing logging system

Usage:
    from backend.utils.performance_profiling import ProfilerManager, profile_endpoint
    
    # Decorator for FastAPI endpoints
    @profile_endpoint(track_memory=True)
    async def my_endpoint():
        pass
    
    # Manual profiling
    profiler = ProfilerManager()
    with profiler.profile_block("custom_operation"):
        # Your code here
        pass
"""

import asyncio
import functools
import logging
import psutil
import time
import tracemalloc
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Callable, Union
import json
from fastapi import Request, Response
from pydantic import BaseModel

# Set up logging
logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetrics:
    """Comprehensive performance metrics for profiling."""
    
    # Timing metrics
    start_time: float
    end_time: Optional[float] = None
    duration_ms: Optional[float] = None
    
    # Resource metrics
    memory_before_mb: Optional[float] = None
    memory_after_mb: Optional[float] = None
    memory_peak_mb: Optional[float] = None
    memory_diff_mb: Optional[float] = None
    
    # CPU metrics
    cpu_percent_before: Optional[float] = None
    cpu_percent_after: Optional[float] = None
    
    # Request metrics (for API endpoints)
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    request_size_bytes: Optional[int] = None
    response_size_bytes: Optional[int] = None
    
    # Database metrics
    query_count: int = 0
    db_time_ms: Optional[float] = None
    
    # Custom metrics
    custom_metrics: Dict[str, Any] = field(default_factory=dict)
    
    def finalize(self) -> None:
        """Calculate derived metrics after measurement completion."""
        if self.end_time:
            self.duration_ms = (self.end_time - self.start_time) * 1000
        
        if self.memory_before_mb and self.memory_after_mb:
            self.memory_diff_mb = self.memory_after_mb - self.memory_before_mb
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for serialization."""
        return {
            'timestamp': datetime.fromtimestamp(self.start_time, tz=timezone.utc).isoformat(),
            'duration_ms': self.duration_ms,
            'memory_before_mb': self.memory_before_mb,
            'memory_after_mb': self.memory_after_mb,
            'memory_peak_mb': self.memory_peak_mb,
            'memory_diff_mb': self.memory_diff_mb,
            'cpu_percent_before': self.cpu_percent_before,
            'cpu_percent_after': self.cpu_percent_after,
            'endpoint': self.endpoint,
            'method': self.method,
            'status_code': self.status_code,
            'request_size_bytes': self.request_size_bytes,
            'response_size_bytes': self.response_size_bytes,
            'query_count': self.query_count,
            'db_time_ms': self.db_time_ms,
            'custom_metrics': self.custom_metrics
        }

class PerformanceTargets:
    """Performance targets and thresholds for the Leaker-Flow application."""
    
    # API Response Time Targets (milliseconds)
    API_RESPONSE_FAST = 200      # Fast operations (GET requests, simple queries)
    API_RESPONSE_MEDIUM = 500    # Medium operations (filtered lists, search)
    API_RESPONSE_SLOW = 1000     # Complex operations (analytics, reports)
    API_RESPONSE_MAX = 2000      # Maximum acceptable response time
    
    # Database Query Targets (milliseconds)
    DB_QUERY_FAST = 50           # Simple queries (by ID, indexed lookups)
    DB_QUERY_MEDIUM = 200        # Complex queries (joins, aggregations)
    DB_QUERY_SLOW = 500          # Heavy queries (analytics, reports)
    DB_QUERY_MAX = 1000          # Maximum acceptable query time
    
    # Memory Usage Targets (MB)
    MEMORY_USAGE_LOW = 10        # Low memory operations
    MEMORY_USAGE_MEDIUM = 50     # Medium memory operations
    MEMORY_USAGE_HIGH = 100      # High memory operations
    MEMORY_USAGE_MAX = 200       # Maximum acceptable memory usage
    
    # Frontend Performance Targets (Web Vitals)
    FCP_TARGET = 1800            # First Contentful Paint (ms)
    LCP_TARGET = 2500            # Largest Contentful Paint (ms)
    FID_TARGET = 100             # First Input Delay (ms)
    CLS_TARGET = 0.1             # Cumulative Layout Shift
    
    @classmethod
    def get_api_target(cls, endpoint: str) -> int:
        """Get appropriate API response time target based on endpoint type."""
        if any(fast_pattern in endpoint for fast_pattern in ['/health', '/check-access', '/{id}']):
            return cls.API_RESPONSE_FAST
        elif any(analytics_pattern in endpoint for analytics_pattern in ['/analytics', '/export', '/report']):
            return cls.API_RESPONSE_SLOW
        else:
            return cls.API_RESPONSE_MEDIUM

class ProfilerManager:
    """Central manager for performance profiling across the application."""
    
    def __init__(self, enable_memory_profiling: bool = True):
        self.enable_memory_profiling = enable_memory_profiling
        self.active_profiles: Dict[str, PerformanceMetrics] = {}
        self.completed_profiles: List[PerformanceMetrics] = []
        
        # Initialize memory tracking if enabled
        if self.enable_memory_profiling:
            try:
                tracemalloc.start()
                logger.info("Memory profiling initialized")
            except RuntimeError:
                logger.warning("Memory profiling already started")
    
    def _get_memory_usage(self) -> float:
        """Get current memory usage in MB."""
        try:
            process = psutil.Process()
            return process.memory_info().rss / 1024 / 1024  # Convert to MB
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return 0.0
    
    def _get_cpu_percent(self) -> float:
        """Get current CPU percentage."""
        try:
            return psutil.cpu_percent(interval=None)
        except Exception:
            return 0.0
    
    def _get_memory_peak(self) -> Optional[float]:
        """Get peak memory usage if tracemalloc is available."""
        if not self.enable_memory_profiling:
            return None
        
        try:
            current, peak = tracemalloc.get_traced_memory()
            return peak / 1024 / 1024  # Convert to MB
        except Exception:
            return None
    
    @contextmanager
    def profile_block(self, block_name: str, track_memory: bool = True):
        """Context manager for profiling a code block."""
        profile_id = f"{block_name}_{time.time()}"
        
        # Start profiling
        metrics = PerformanceMetrics(start_time=time.time())
        
        if track_memory and self.enable_memory_profiling:
            metrics.memory_before_mb = self._get_memory_usage()
            metrics.cpu_percent_before = self._get_cpu_percent()
        
        self.active_profiles[profile_id] = metrics
        
        try:
            yield metrics
        finally:
            # End profiling
            metrics.end_time = time.time()
            
            if track_memory and self.enable_memory_profiling:
                metrics.memory_after_mb = self._get_memory_usage()
                metrics.memory_peak_mb = self._get_memory_peak()
                metrics.cpu_percent_after = self._get_cpu_percent()
            
            metrics.finalize()
            
            # Move to completed profiles
            self.completed_profiles.append(metrics)
            del self.active_profiles[profile_id]
            
            # Log performance metrics
            self._log_metrics(block_name, metrics)
    
    @asynccontextmanager
    async def profile_async_block(self, block_name: str, track_memory: bool = True):
        """Async context manager for profiling async code blocks."""
        profile_id = f"{block_name}_{time.time()}"
        
        # Start profiling
        metrics = PerformanceMetrics(start_time=time.time())
        
        if track_memory and self.enable_memory_profiling:
            metrics.memory_before_mb = self._get_memory_usage()
            metrics.cpu_percent_before = self._get_cpu_percent()
        
        self.active_profiles[profile_id] = metrics
        
        try:
            yield metrics
        finally:
            # End profiling
            metrics.end_time = time.time()
            
            if track_memory and self.enable_memory_profiling:
                metrics.memory_after_mb = self._get_memory_usage()
                metrics.memory_peak_mb = self._get_memory_peak()
                metrics.cpu_percent_after = self._get_cpu_percent()
            
            metrics.finalize()
            
            # Move to completed profiles
            self.completed_profiles.append(metrics)
            del self.active_profiles[profile_id]
            
            # Log performance metrics
            self._log_metrics(block_name, metrics)
    
    def _log_metrics(self, operation_name: str, metrics: PerformanceMetrics):
        """Log performance metrics with appropriate level based on performance."""
        duration = metrics.duration_ms or 0
        memory_diff = metrics.memory_diff_mb or 0
        
        # Determine log level based on performance
        if duration > PerformanceTargets.API_RESPONSE_MAX or abs(memory_diff) > PerformanceTargets.MEMORY_USAGE_HIGH:
            log_level = logging.WARNING
            log_msg = f"⚠️  SLOW OPERATION: {operation_name}"
        elif duration > PerformanceTargets.API_RESPONSE_MEDIUM or abs(memory_diff) > PerformanceTargets.MEMORY_USAGE_MEDIUM:
            log_level = logging.INFO
            log_msg = f"📊 PERFORMANCE: {operation_name}"
        else:
            log_level = logging.DEBUG
            log_msg = f"✅ FAST OPERATION: {operation_name}"
        
        # Create detailed metrics string
        metrics_str = f"Duration: {duration:.1f}ms"
        if memory_diff != 0:
            metrics_str += f", Memory: {memory_diff:+.1f}MB"
        if metrics.cpu_percent_before and metrics.cpu_percent_after:
            cpu_diff = metrics.cpu_percent_after - metrics.cpu_percent_before
            metrics_str += f", CPU: {cpu_diff:+.1f}%"
        
        logger.log(log_level, f"{log_msg} - {metrics_str}")
    
    def get_performance_report(self, last_n: Optional[int] = None) -> Dict[str, Any]:
        """Generate a comprehensive performance report."""
        profiles = self.completed_profiles[-last_n:] if last_n else self.completed_profiles
        
        if not profiles:
            return {"message": "No performance data available"}
        
        # Calculate statistics
        durations = [p.duration_ms for p in profiles if p.duration_ms]
        memory_diffs = [p.memory_diff_mb for p in profiles if p.memory_diff_mb]
        
        stats = {
            "total_operations": len(profiles),
            "time_range": {
                "start": datetime.fromtimestamp(profiles[0].start_time, tz=timezone.utc).isoformat(),
                "end": datetime.fromtimestamp(profiles[-1].start_time, tz=timezone.utc).isoformat()
            }
        }
        
        if durations:
            stats["duration_stats"] = {
                "avg_ms": sum(durations) / len(durations),
                "min_ms": min(durations),
                "max_ms": max(durations),
                "total_ms": sum(durations)
            }
        
        if memory_diffs:
            stats["memory_stats"] = {
                "avg_diff_mb": sum(memory_diffs) / len(memory_diffs),
                "min_diff_mb": min(memory_diffs),
                "max_diff_mb": max(memory_diffs),
                "total_diff_mb": sum(memory_diffs)
            }
        
        # Performance issues
        slow_operations = [p for p in profiles if p.duration_ms and p.duration_ms > PerformanceTargets.API_RESPONSE_SLOW]
        high_memory_operations = [p for p in profiles if p.memory_diff_mb and abs(p.memory_diff_mb) > PerformanceTargets.MEMORY_USAGE_HIGH]
        
        stats["performance_issues"] = {
            "slow_operations": len(slow_operations),
            "high_memory_operations": len(high_memory_operations),
            "slowest_operation": max(profiles, key=lambda p: p.duration_ms or 0).to_dict() if durations else None
        }
        
        return stats

# Global profiler instance
profiler_manager = ProfilerManager()

def profile_endpoint(
    track_memory: bool = True,
    custom_metrics: Optional[Dict[str, Any]] = None
):
    """Decorator for profiling FastAPI endpoints."""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Extract request and response if available
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            endpoint_name = func.__name__
            if request:
                endpoint_name = f"{request.method} {request.url.path}"
            
            async with profiler_manager.profile_async_block(
                endpoint_name, 
                track_memory=track_memory
            ) as metrics:
                # Add request metrics
                if request:
                    metrics.endpoint = str(request.url.path)
                    metrics.method = request.method
                    
                    # Calculate request size
                    if hasattr(request, 'body'):
                        try:
                            body = await request.body()
                            metrics.request_size_bytes = len(body)
                        except Exception:
                            pass
                
                # Add custom metrics
                if custom_metrics:
                    metrics.custom_metrics.update(custom_metrics)
                
                # Execute the endpoint
                result = await func(*args, **kwargs)
                
                # Add response metrics
                if hasattr(result, 'status_code'):
                    metrics.status_code = result.status_code
                
                # Calculate response size (approximate)
                if hasattr(result, 'body'):
                    try:
                        metrics.response_size_bytes = len(result.body)
                    except Exception:
                        pass
                
                return result
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            endpoint_name = func.__name__
            
            with profiler_manager.profile_block(
                endpoint_name, 
                track_memory=track_memory
            ) as metrics:
                # Add custom metrics
                if custom_metrics:
                    metrics.custom_metrics.update(custom_metrics)
                
                # Execute the function
                result = func(*args, **kwargs)
                
                return result
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

# Database profiling utilities
class DatabaseProfiler:
    """Utilities for profiling database operations."""
    
    @staticmethod
    def analyze_query_performance(query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Analyze query performance using EXPLAIN ANALYZE (placeholder)."""
        # This would integrate with Supabase to run EXPLAIN ANALYZE
        return {
            "query": query,
            "params": params,
            "analysis": "Placeholder for EXPLAIN ANALYZE results",
            "recommendations": []
        }
    
    @staticmethod
    def get_slow_queries() -> List[Dict[str, Any]]:
        """Get list of slow queries (placeholder)."""
        # This would integrate with pg_stat_statements
        return []

# Performance monitoring middleware
class PerformanceMonitoringMiddleware:
    """FastAPI middleware for automatic performance monitoring."""
    
    def __init__(self, app, track_all_requests: bool = False):
        self.app = app
        self.track_all_requests = track_all_requests
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request_start = time.time()
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # Log performance metrics
                duration_ms = (time.time() - request_start) * 1000
                
                path = scope.get("path", "unknown")
                method = scope.get("method", "unknown")
                status_code = message.get("status", 0)
                
                # Log based on performance
                if duration_ms > PerformanceTargets.API_RESPONSE_SLOW:
                    logger.warning(f"🐌 SLOW REQUEST: {method} {path} - {duration_ms:.1f}ms (Status: {status_code})")
                elif self.track_all_requests:
                    logger.info(f"📊 REQUEST: {method} {path} - {duration_ms:.1f}ms (Status: {status_code})")
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)

# Export key components
__all__ = [
    'ProfilerManager',
    'PerformanceMetrics',
    'PerformanceTargets',
    'profile_endpoint',
    'profiler_manager',
    'DatabaseProfiler',
    'PerformanceMonitoringMiddleware'
] 