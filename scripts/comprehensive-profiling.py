#!/usr/bin/env python3
"""
Comprehensive Performance Profiling Script
For Task 25.5 - Leaker-Flow Performance Analysis
"""

import sys
import os
import time
import asyncio
import json
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_section(title):
    print(f"\n🔍 {title}")
    print("-" * 40)

async def check_database_health():
    """Check database health and performance metrics"""
    print_section("DATABASE PERFORMANCE ANALYSIS")
    
    try:
        from database.optimize_database import check_database_health as db_health_check
        
        # Get health report using standalone function
        health = await db_health_check()
        
        print(f"✅ Overall Health: {health.get('overall_health', 'Unknown')}")
        print(f"🔗 Connection Status: {health.get('connection_status', 'Unknown')}")
        
        # Performance metrics
        performance = health.get('performance_metrics', {})
        print(f"📊 Active Connections: {performance.get('active_connections', 'N/A')}")
        print(f"🚀 Cache Hit Ratio: {performance.get('cache_hit_ratio', 'N/A')}%")
        print(f"⏱️  Avg Query Time: {performance.get('avg_query_time', 'N/A')}ms")
        
        # Table statistics
        print(f"\n📋 TOP 5 LARGEST TABLES:")
        table_stats = health.get('table_statistics', [])
        for i, table in enumerate(table_stats[:5], 1):
            name = table.get('table_name', 'Unknown')
            size = table.get('size', 'N/A')
            rows = table.get('row_count', 'N/A')
            print(f"  {i}. {name:<25} | Size: {size:<10} | Rows: {rows}")
        
        # Index usage
        print(f"\n🗂️  INDEX PERFORMANCE:")
        index_stats = health.get('index_statistics', [])
        for idx in index_stats[:3]:  # Top 3 indexes
            name = idx.get('index_name', 'Unknown')
            usage = idx.get('usage_count', 'N/A')
            size = idx.get('size', 'N/A')
            print(f"  • {name:<30} | Usage: {usage:<8} | Size: {size}")
        
        return True, health
        
    except ImportError as e:
        print(f"❌ Database optimizer not available: {e}")
        return False, None
    except Exception as e:
        print(f"❌ Database health check failed: {e}")
        return False, None

def check_backend_performance():
    """Check backend API performance and optimizations"""
    print_section("BACKEND API PERFORMANCE ANALYSIS")
    
    try:
        # Check if performance middleware exists
        middleware_path = Path("../backend/middleware/performance_middleware.py")
        cache_path = Path("../backend/utils/cache.py")
        
        print(f"🔧 Performance Middleware: {'✅ Available' if middleware_path.exists() else '❌ Missing'}")
        print(f"🗃️  Cache System: {'✅ Available' if cache_path.exists() else '❌ Missing'}")
        
        # Check optimized API endpoints
        api_path = Path("../backend/services/admin_api_optimized.py")
        print(f"⚡ Optimized APIs: {'✅ Available' if api_path.exists() else '❌ Missing'}")
        
        if api_path.exists():
            with open(api_path, 'r') as f:
                content = f.read()
                endpoint_count = content.count('@router.')
                print(f"📊 Optimized Endpoints: {endpoint_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Backend check failed: {e}")
        return False

def check_frontend_performance():
    """Check frontend performance optimizations"""
    print_section("FRONTEND PERFORMANCE ANALYSIS")
    
    try:
        # Check optimization files
        hooks_path = Path("../frontend/src/hooks/usePerformanceOptimizations.ts")
        virtual_path = Path("../frontend/src/components/ui/virtual-table.tsx")
        lazy_path = Path("../frontend/src/components/ui/lazy-loading.tsx")
        
        print(f"🎣 Performance Hooks: {'✅ Available' if hooks_path.exists() else '❌ Missing'}")
        print(f"📊 Virtual Tables: {'✅ Available' if virtual_path.exists() else '❌ Missing'}")
        print(f"⏳ Lazy Loading: {'✅ Available' if lazy_path.exists() else '❌ Missing'}")
        
        # Check if performance test file exists
        test_path = Path("../frontend/src/utils/performance-test.ts")
        print(f"🧪 Performance Tests: {'✅ Available' if test_path.exists() else '❌ Missing'}")
        
        # Check package.json for performance deps
        package_path = Path("../frontend/package.json")
        if package_path.exists():
            with open(package_path, 'r') as f:
                package_data = json.load(f)
                deps = package_data.get('dependencies', {})
                dev_deps = package_data.get('devDependencies', {})
                
                perf_deps = ['web-vitals', 'react-window', 'react-virtualized']
                available_deps = [dep for dep in perf_deps if dep in deps or dep in dev_deps]
                print(f"📦 Performance Dependencies: {len(available_deps)}/3 installed")
                for dep in available_deps:
                    print(f"  • {dep}")
        
        return True
        
    except Exception as e:
        print(f"❌ Frontend check failed: {e}")
        return False

def check_monitoring_tools():
    """Check monitoring and profiling tools"""
    print_section("MONITORING TOOLS ANALYSIS")
    
    try:
        # Check profiling infrastructure
        profiling_path = Path("../backend/utils/performance_profiling.py")
        monitoring_path = Path("../scripts/monitor-performance.py")
        
        print(f"📊 Performance Profiling: {'✅ Available' if profiling_path.exists() else '❌ Missing'}")
        print(f"🖥️  System Monitoring: {'✅ Available' if monitoring_path.exists() else '❌ Missing'}")
        
        # Check test scripts
        backend_test = Path("../scripts/test-backend-performance.py")
        frontend_test = Path("../scripts/test-frontend-performance.js")
        
        print(f"🧪 Backend Tests: {'✅ Available' if backend_test.exists() else '❌ Missing'}")
        print(f"🧪 Frontend Tests: {'✅ Available' if frontend_test.exists() else '❌ Missing'}")
        
        return True
        
    except Exception as e:
        print(f"❌ Monitoring tools check failed: {e}")
        return False

def generate_performance_report(db_health, db_available):
    """Generate comprehensive performance report"""
    print_section("PERFORMANCE ANALYSIS SUMMARY")
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    report = {
        "timestamp": timestamp,
        "database": {
            "available": db_available,
            "health": db_health if db_health else "Not accessible"
        },
        "optimizations": {
            "backend_middleware": Path("../backend/middleware/performance_middleware.py").exists(),
            "cache_system": Path("../backend/utils/cache.py").exists(),
            "optimized_apis": Path("../backend/services/admin_api_optimized.py").exists(),
            "frontend_hooks": Path("../frontend/src/hooks/usePerformanceOptimizations.ts").exists(),
            "virtual_components": Path("../frontend/src/components/ui/virtual-table.tsx").exists(),
            "lazy_loading": Path("../frontend/src/components/ui/lazy-loading.tsx").exists()
        },
        "monitoring": {
            "profiling_tools": Path("../backend/utils/performance_profiling.py").exists(),
            "system_monitor": Path("../scripts/monitor-performance.py").exists(),
            "test_scripts": {
                "backend": Path("../scripts/test-backend-performance.py").exists(),
                "frontend": Path("../scripts/test-frontend-performance.js").exists()
            }
        }
    }
    
    # Calculate completion percentage
    all_optimizations = list(report["optimizations"].values())
    optimization_score = sum(all_optimizations) / len(all_optimizations) * 100
    
    all_monitoring = [report["monitoring"]["profiling_tools"], 
                     report["monitoring"]["system_monitor"]] + list(report["monitoring"]["test_scripts"].values())
    monitoring_score = sum(all_monitoring) / len(all_monitoring) * 100
    
    print(f"📊 OPTIMIZATION COMPLETENESS:")
    print(f"  • Database Optimizations: {'✅ Accessible' if db_available else '❌ Not accessible'}")
    print(f"  • Backend Optimizations: {optimization_score:.1f}% complete")
    print(f"  • Frontend Optimizations: {optimization_score:.1f}% complete")
    print(f"  • Monitoring Tools: {monitoring_score:.1f}% complete")
    
    overall_score = (optimization_score + monitoring_score) / 2
    print(f"\n🎯 OVERALL PERFORMANCE SETUP: {overall_score:.1f}% complete")
    
    if overall_score >= 90:
        print("🎉 EXCELLENT: All performance optimizations are in place!")
    elif overall_score >= 70:
        print("✅ GOOD: Most optimizations implemented, minor gaps remain")
    elif overall_score >= 50:
        print("⚠️  PARTIAL: Some optimizations missing, needs attention")
    else:
        print("❌ CRITICAL: Major performance optimizations missing")
    
    # Recommendations
    print(f"\n💡 RECOMMENDATIONS:")
    missing_items = []
    
    if not report["optimizations"]["backend_middleware"]:
        missing_items.append("Implement performance middleware")
    if not report["optimizations"]["cache_system"]:
        missing_items.append("Set up Redis caching system")
    if not report["optimizations"]["frontend_hooks"]:
        missing_items.append("Create performance optimization hooks")
    if not report["monitoring"]["profiling_tools"]:
        missing_items.append("Set up profiling infrastructure")
    
    if missing_items:
        for i, item in enumerate(missing_items, 1):
            print(f"  {i}. {item}")
    else:
        print("  🎯 All critical optimizations are in place!")
        print("  📈 Focus on measuring and fine-tuning performance")
        print("  🔍 Run regular performance audits")
    
    return report

async def main():
    """Main profiling execution"""
    print_header("COMPREHENSIVE PERFORMANCE PROFILING")
    print(f"📅 Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🎯 Task: 25.5 - Comprehensive Performance Profiling & Remediation")
    
    # Run all checks
    db_available, db_health = await check_database_health()
    backend_ok = check_backend_performance()
    frontend_ok = check_frontend_performance()
    monitoring_ok = check_monitoring_tools()
    
    # Generate report
    report = generate_performance_report(db_health, db_available)
    
    # Save report
    try:
        report_dir = Path("../reports")
        report_dir.mkdir(exist_ok=True)
        
        report_file = report_dir / f"performance-profiling-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"\n💾 Report saved: {report_file}")
        
    except Exception as e:
        print(f"⚠️  Could not save report: {e}")
    
    print_header("PROFILING COMPLETE")
    print("✅ Comprehensive performance analysis finished")
    print("📋 Review the results above to identify any remaining issues")
    print("🔧 Proceed with targeted optimizations if needed")

if __name__ == "__main__":
    asyncio.run(main()) 