#!/bin/bash

# Performance Tools Setup Script for Leaker-Flow
# ==============================================
# 
# This script installs and configures all performance monitoring tools
# for the Leaker-Flow application stack.

set -e  # Exit on any error

echo "🚀 Setting up Performance Monitoring Tools for Leaker-Flow"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -f "backend/requirements.txt" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "Project structure verified"

# 1. Frontend Performance Tools Setup
echo -e "\n${BLUE}📦 Installing Frontend Performance Tools${NC}"
echo "========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

print_info "Node.js version: $(node --version)"

# Install frontend performance dependencies
print_info "Installing web-vitals and performance analysis tools..."
cd frontend

# Core performance monitoring packages
npm install web-vitals

# Development tools for performance analysis
npm install --save-dev @next/bundle-analyzer
npm install --save-dev lighthouse
npm install --save-dev webpack-bundle-analyzer

# Performance testing tools
npm install --save-dev @testing-library/react
npm install --save-dev @testing-library/jest-dom

print_status "Frontend performance tools installed"

# Configure bundle analyzer for Next.js
print_info "Configuring Next.js bundle analyzer..."

# Create or update next.config.js with bundle analyzer
cat > next.config.js << 'EOF'
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for better performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Enable gzip compression
  compress: true,
  
  // Optimize production builds
  poweredByHeader: false,
  generateEtags: false,
  
  // Performance optimizations
  swcMinify: true,
  
  // Bundle analyzer configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimize bundle splitting
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      };
    }
    
    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
EOF

print_status "Next.js configuration updated"

# Add performance scripts to package.json
print_info "Adding performance analysis scripts..."

# Create performance testing script
cat > scripts/performance-test.js << 'EOF'
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

async function runLighthouseTests() {
  const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});
  const options = {
    logLevel: 'info',
    output: 'html',
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    port: chrome.port,
  };

  // Test different pages
  const pages = [
    { name: 'home', url: 'http://localhost:3000' },
    { name: 'admin-dashboard', url: 'http://localhost:3000/admin' },
    { name: 'analytics', url: 'http://localhost:3000/admin/analytics' },
  ];

  const results = {};

  for (const page of pages) {
    console.log(`Testing ${page.name}...`);
    try {
      const runnerResult = await lighthouse(page.url, options);
      results[page.name] = {
        score: runnerResult.lhr.categories.performance.score * 100,
        metrics: {
          fcp: runnerResult.lhr.audits['first-contentful-paint'].numericValue,
          lcp: runnerResult.lhr.audits['largest-contentful-paint'].numericValue,
          cls: runnerResult.lhr.audits['cumulative-layout-shift'].numericValue,
          fid: runnerResult.lhr.audits['max-potential-fid'].numericValue,
          ttfb: runnerResult.lhr.audits['server-response-time'].numericValue,
        }
      };

      // Save detailed report
      const reportPath = path.join(__dirname, '..', 'reports', `lighthouse-${page.name}-${Date.now()}.html`);
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, runnerResult.report);
      
      console.log(`Report saved: ${reportPath}`);
    } catch (error) {
      console.error(`Error testing ${page.name}:`, error.message);
    }
  }

  await chrome.kill();

  // Generate summary report
  console.log('\n📊 Performance Summary:');
  console.log('======================');
  Object.entries(results).forEach(([page, data]) => {
    console.log(`${page}: ${data.score.toFixed(1)}% (FCP: ${data.metrics.fcp.toFixed(0)}ms, LCP: ${data.metrics.lcp.toFixed(0)}ms)`);
  });

  return results;
}

if (require.main === module) {
  runLighthouseTests().catch(console.error);
}

module.exports = { runLighthouseTests };
EOF

# Install lighthouse globally if not present
if ! command -v lighthouse &> /dev/null; then
    print_info "Installing Lighthouse globally..."
    npm install -g lighthouse
fi

cd ..

# 2. Backend Performance Tools Setup
echo -e "\n${BLUE}🐍 Installing Backend Performance Tools${NC}"
echo "========================================"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

print_info "Python version: $(python3 --version)"

cd backend

# Install backend performance monitoring packages
print_info "Installing Python performance monitoring packages..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate || source venv/Scripts/activate

# Install performance monitoring packages
pip install psutil memory-profiler line-profiler py-spy

# Install load testing tools
pip install locust

# Install database profiling tools
pip install sqlalchemy-utils

print_status "Backend performance tools installed"

# Create performance testing configuration
print_info "Creating load testing configuration..."

cat > tests/load_test.py << 'EOF'
"""
Load Testing for Leaker-Flow Admin API
====================================

Run with: locust -f tests/load_test.py --host=http://localhost:8000
"""

from locust import HttpUser, task, between
import json
import random

class AdminUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login and get auth token"""
        # This would need to be adapted based on your auth system
        self.login()
    
    def login(self):
        """Simulate admin login"""
        # Mock login - adapt to your actual auth endpoint
        response = self.client.post("/auth/login", json={
            "email": "admin@leakerflow.com",
            "password": "test_password"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})
    
    @task(3)
    def view_articles_list(self):
        """Test article listing performance"""
        self.client.get("/api/admin/articles", name="articles_list")
    
    @task(2)
    def view_analytics_overview(self):
        """Test analytics overview performance"""
        self.client.get("/api/admin/analytics/overview", name="analytics_overview")
    
    @task(2)
    def view_analytics_trends(self):
        """Test analytics trends performance"""
        params = {
            "period": random.choice(["7d", "30d", "90d"]),
            "category": random.choice(["technology", "science", "business", ""])
        }
        self.client.get("/api/admin/analytics/trends", params=params, name="analytics_trends")
    
    @task(1)
    def view_analytics_categories(self):
        """Test category analytics performance"""
        self.client.get("/api/admin/analytics/categories", name="analytics_categories")
    
    @task(1)
    def view_top_authors(self):
        """Test top authors analytics performance"""
        self.client.get("/api/admin/analytics/top-authors", name="top_authors")
    
    @task(1)
    def export_analytics_data(self):
        """Test analytics export performance"""
        params = {
            "format": random.choice(["csv", "json"]),
            "date_range": "30d"
        }
        self.client.get("/api/admin/analytics/export", params=params, name="analytics_export")
    
    @task(1)
    def view_applications(self):
        """Test applications listing performance"""
        self.client.get("/api/admin/applications", name="applications_list")
    
    @task(1)
    def health_check(self):
        """Test health endpoint performance"""
        self.client.get("/health", name="health_check")

class RegularUser(HttpUser):
    wait_time = between(2, 5)
    
    @task(5)
    def view_public_articles(self):
        """Test public article viewing"""
        self.client.get("/api/articles", name="public_articles")
    
    @task(2)
    def search_articles(self):
        """Test article search performance"""
        search_terms = ["technology", "science", "business", "AI", "climate"]
        params = {"q": random.choice(search_terms)}
        self.client.get("/api/articles/search", params=params, name="article_search")
    
    @task(1)
    def health_check(self):
        """Test health endpoint"""
        self.client.get("/health", name="health_check")
EOF

print_status "Load testing configuration created"

cd ..

# 3. Database Performance Tools Setup
echo -e "\n${BLUE}🗄️  Database Performance Monitoring Setup${NC}"
echo "=========================================="

print_info "Creating database performance monitoring scripts..."

# Create database performance analysis script
mkdir -p scripts/db-performance

cat > scripts/db-performance/analyze-queries.sql << 'EOF'
-- Database Performance Analysis for Leaker-Flow
-- ==============================================

-- Enable pg_stat_statements extension (run as superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 1. Find slowest queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_time DESC 
LIMIT 20;

-- 2. Most frequently called queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC 
LIMIT 20;

-- 3. Queries with highest total time
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_time DESC 
LIMIT 20;

-- 4. Index usage analysis
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'Never used'
        WHEN idx_scan < 100 THEN 'Rarely used'
        ELSE 'Frequently used'
    END as usage_status
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- 5. Table size analysis
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- 6. Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_stat_user_indexes 
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- 7. Lock analysis
SELECT 
    pid,
    state,
    query,
    wait_event_type,
    wait_event
FROM pg_stat_activity 
WHERE state != 'idle' 
AND query NOT LIKE '%pg_stat_activity%';

-- 8. Connection analysis
SELECT 
    state,
    count(*) as connections
FROM pg_stat_activity 
GROUP BY state
ORDER BY connections DESC;
EOF

print_status "Database performance analysis scripts created"

# 4. Create Performance Monitoring Dashboard
echo -e "\n${BLUE}📊 Setting up Performance Monitoring Dashboard${NC}"
echo "=============================================="

print_info "Creating performance monitoring utilities..."

# Create performance monitoring script
cat > scripts/monitor-performance.py << 'EOF'
#!/usr/bin/env python3
"""
Performance Monitoring Script for Leaker-Flow
============================================

Monitors system performance and generates reports.
"""

import psutil
import time
import json
import subprocess
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any

class SystemMonitor:
    def __init__(self):
        self.start_time = time.time()
        self.metrics_history = []
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get current system performance metrics"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Network I/O
        network = psutil.net_io_counters()
        
        # Process count
        process_count = len(psutil.pids())
        
        return {
            'timestamp': datetime.now().isoformat(),
            'cpu': {
                'percent': cpu_percent,
                'count': psutil.cpu_count(),
                'freq': psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None
            },
            'memory': {
                'total': memory.total,
                'available': memory.available,
                'percent': memory.percent,
                'used': memory.used,
                'free': memory.free
            },
            'disk': {
                'total': disk.total,
                'used': disk.used,
                'free': disk.free,
                'percent': disk.percent
            },
            'network': {
                'bytes_sent': network.bytes_sent,
                'bytes_recv': network.bytes_recv,
                'packets_sent': network.packets_sent,
                'packets_recv': network.packets_recv
            },
            'processes': process_count
        }
    
    def check_backend_health(self) -> Dict[str, Any]:
        """Check backend API health"""
        try:
            import requests
            response = requests.get('http://localhost:8000/health', timeout=5)
            return {
                'status': 'healthy' if response.status_code == 200 else 'unhealthy',
                'response_time': response.elapsed.total_seconds() * 1000,
                'status_code': response.status_code
            }
        except Exception as e:
            return {
                'status': 'unreachable',
                'error': str(e),
                'response_time': None,
                'status_code': None
            }
    
    def check_frontend_health(self) -> Dict[str, Any]:
        """Check frontend health"""
        try:
            import requests
            response = requests.get('http://localhost:3000', timeout=5)
            return {
                'status': 'healthy' if response.status_code == 200 else 'unhealthy',
                'response_time': response.elapsed.total_seconds() * 1000,
                'status_code': response.status_code
            }
        except Exception as e:
            return {
                'status': 'unreachable',
                'error': str(e),
                'response_time': None,
                'status_code': None
            }
    
    def monitor_loop(self, duration_minutes: int = 5, interval_seconds: int = 30):
        """Run monitoring loop"""
        end_time = time.time() + (duration_minutes * 60)
        
        print(f"🔍 Starting performance monitoring for {duration_minutes} minutes...")
        print(f"📊 Collecting metrics every {interval_seconds} seconds")
        print("=" * 60)
        
        while time.time() < end_time:
            metrics = {
                'system': self.get_system_metrics(),
                'backend': self.check_backend_health(),
                'frontend': self.check_frontend_health()
            }
            
            self.metrics_history.append(metrics)
            
            # Print current status
            system = metrics['system']
            backend = metrics['backend']
            frontend = metrics['frontend']
            
            print(f"⏰ {datetime.now().strftime('%H:%M:%S')} | "
                  f"CPU: {system['cpu']['percent']:.1f}% | "
                  f"RAM: {system['memory']['percent']:.1f}% | "
                  f"Backend: {backend['status']} ({backend.get('response_time', 'N/A')}) | "
                  f"Frontend: {frontend['status']} ({frontend.get('response_time', 'N/A')})")
            
            time.sleep(interval_seconds)
        
        return self.generate_report()
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate performance report"""
        if not self.metrics_history:
            return {'error': 'No metrics collected'}
        
        # Calculate averages
        cpu_values = [m['system']['cpu']['percent'] for m in self.metrics_history]
        memory_values = [m['system']['memory']['percent'] for m in self.metrics_history]
        backend_times = [m['backend']['response_time'] for m in self.metrics_history if m['backend']['response_time']]
        frontend_times = [m['frontend']['response_time'] for m in self.metrics_history if m['frontend']['response_time']]
        
        report = {
            'monitoring_period': {
                'start': self.metrics_history[0]['system']['timestamp'],
                'end': self.metrics_history[-1]['system']['timestamp'],
                'duration_minutes': len(self.metrics_history) * 0.5,  # Assuming 30s intervals
                'samples': len(self.metrics_history)
            },
            'system_performance': {
                'cpu': {
                    'average': sum(cpu_values) / len(cpu_values),
                    'max': max(cpu_values),
                    'min': min(cpu_values)
                },
                'memory': {
                    'average': sum(memory_values) / len(memory_values),
                    'max': max(memory_values),
                    'min': min(memory_values)
                }
            },
            'api_performance': {
                'backend': {
                    'average_response_time': sum(backend_times) / len(backend_times) if backend_times else None,
                    'max_response_time': max(backend_times) if backend_times else None,
                    'min_response_time': min(backend_times) if backend_times else None,
                    'availability': len(backend_times) / len(self.metrics_history) * 100
                },
                'frontend': {
                    'average_response_time': sum(frontend_times) / len(frontend_times) if frontend_times else None,
                    'max_response_time': max(frontend_times) if frontend_times else None,
                    'min_response_time': min(frontend_times) if frontend_times else None,
                    'availability': len(frontend_times) / len(self.metrics_history) * 100
                }
            },
            'alerts': []
        }
        
        # Generate alerts
        if report['system_performance']['cpu']['average'] > 80:
            report['alerts'].append('High CPU usage detected')
        if report['system_performance']['memory']['average'] > 80:
            report['alerts'].append('High memory usage detected')
        if backend_times and report['api_performance']['backend']['average_response_time'] > 1000:
            report['alerts'].append('Slow backend API response times')
        if frontend_times and report['api_performance']['frontend']['average_response_time'] > 2000:
            report['alerts'].append('Slow frontend response times')
        
        return report

def main():
    if len(sys.argv) > 1:
        duration = int(sys.argv[1])
    else:
        duration = 5
    
    monitor = SystemMonitor()
    report = monitor.monitor_loop(duration_minutes=duration)
    
    # Save report
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_file = f'reports/performance_report_{timestamp}.json'
    
    import os
    os.makedirs('reports', exist_ok=True)
    
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n📊 Performance Report Generated: {report_file}")
    print("=" * 60)
    
    # Print summary
    if 'alerts' in report and report['alerts']:
        print("⚠️  ALERTS:")
        for alert in report['alerts']:
            print(f"   - {alert}")
    else:
        print("✅ No performance issues detected")
    
    print(f"\n📈 SYSTEM PERFORMANCE:")
    print(f"   CPU Average: {report['system_performance']['cpu']['average']:.1f}%")
    print(f"   Memory Average: {report['system_performance']['memory']['average']:.1f}%")
    
    if report['api_performance']['backend']['average_response_time']:
        print(f"\n🔧 API PERFORMANCE:")
        print(f"   Backend Avg: {report['api_performance']['backend']['average_response_time']:.1f}ms")
        print(f"   Frontend Avg: {report['api_performance']['frontend']['average_response_time']:.1f}ms")

if __name__ == '__main__':
    main()
EOF

chmod +x scripts/monitor-performance.py

print_status "Performance monitoring dashboard created"

# 5. Setup environment variables and configuration
echo -e "\n${BLUE}⚙️  Configuring Performance Monitoring Environment${NC}"
echo "================================================="

print_info "Creating performance configuration..."

# Add performance environment variables
cat >> .env.example << 'EOF'

# Performance Monitoring Configuration
ENABLE_PERFORMANCE_PROFILING=true
PERFORMANCE_LOG_LEVEL=INFO
TRACK_ALL_REQUESTS=false

# Load Testing Configuration
LOAD_TEST_USERS=10
LOAD_TEST_SPAWN_RATE=2
LOAD_TEST_DURATION=300

# Lighthouse Configuration
LIGHTHOUSE_CHROME_FLAGS=--headless,--no-sandbox,--disable-gpu
EOF

print_status "Environment configuration updated"

# 6. Create documentation and usage instructions
echo -e "\n${BLUE}📚 Creating Performance Monitoring Documentation${NC}"
echo "=============================================="

cat > docs/performance/USAGE.md << 'EOF'
# Performance Monitoring Usage Guide

## Quick Start

### 1. Backend Performance Profiling

```bash
# Start backend with performance profiling enabled
cd backend
export ENABLE_PERFORMANCE_PROFILING=true
python -m uvicorn main:app --reload

# Monitor performance in real-time
python scripts/monitor-performance.py 10  # Monitor for 10 minutes
```

### 2. Frontend Performance Analysis

```bash
# Run bundle analysis
cd frontend
npm run build
ANALYZE=true npm run build

# Run Lighthouse performance audit
npm run lighthouse

# Run performance tests
npm run test:performance
```

### 3. Load Testing

```bash
# Start the application first
cd backend
uvicorn main:app --reload

# In another terminal, run load tests
cd backend
locust -f tests/load_test.py --host=http://localhost:8000 --users 10 --spawn-rate 2 --run-time 300s
```

### 4. Database Performance Analysis

```bash
# Connect to your database and run:
psql -h localhost -d leaker_flow -f scripts/db-performance/analyze-queries.sql
```

## Performance Targets

### API Response Times
- Fast operations: < 200ms
- Medium operations: < 500ms
- Complex operations: < 1000ms

### Frontend Metrics
- First Contentful Paint: < 1.8s
- Largest Contentful Paint: < 2.5s
- First Input Delay: < 100ms
- Cumulative Layout Shift: < 0.1

### System Resources
- CPU usage: < 70% average
- Memory usage: < 80% average
- Database queries: < 1000ms each

## Troubleshooting

### Common Issues

1. **High API Response Times**
   - Check database query performance
   - Verify proper indexing
   - Monitor CPU and memory usage

2. **Poor Frontend Performance**
   - Run bundle analysis to identify large dependencies
   - Check for unnecessary re-renders
   - Optimize images and fonts

3. **Database Bottlenecks**
   - Review slow query log
   - Check index usage
   - Monitor connection pool

## Automated Monitoring

The system automatically:
- Tracks Web Vitals on all pages
- Monitors API response times
- Logs performance issues
- Sends alerts for degraded performance

## Reports

Performance reports are saved in the `reports/` directory:
- `lighthouse-*.html` - Lighthouse audit reports
- `performance_report_*.json` - System monitoring reports
- `bundle-analyzer-*.html` - Bundle analysis reports
EOF

print_status "Performance monitoring documentation created"

# 7. Final setup and verification
echo -e "\n${BLUE}🔧 Final Setup and Verification${NC}"
echo "=============================="

# Create reports directory
mkdir -p reports
mkdir -p docs/performance

# Install Python monitoring packages if not in virtual environment
cd backend
if [ ! -d "venv" ]; then
    print_info "Installing Python packages globally..."
    pip3 install psutil requests
fi
cd ..

# Add scripts to package.json
cd frontend
print_info "Adding performance scripts to package.json..."

# Check if jq is available for JSON manipulation
if command -v jq &> /dev/null; then
    # Use jq to add scripts
    jq '.scripts.analyze = "ANALYZE=true npm run build"' package.json > package.json.tmp
    jq '.scripts.lighthouse = "lighthouse http://localhost:3000 --output=html --output-path=../reports/lighthouse-$(date +%Y%m%d).html"' package.json.tmp > package.json
    rm package.json.tmp
else
    print_warning "jq not found. Please manually add these scripts to package.json:"
    echo "  \"analyze\": \"ANALYZE=true npm run build\","
    echo "  \"lighthouse\": \"lighthouse http://localhost:3000 --output=html --output-path=../reports/lighthouse-\$(date +%Y%m%d).html\""
fi

cd ..

print_status "Performance tools setup completed!"

echo -e "\n${GREEN}🎉 Performance Monitoring Setup Complete!${NC}"
echo "========================================"
echo ""
echo "📋 What was installed:"
echo "  ✅ Frontend: web-vitals, lighthouse, bundle-analyzer"
echo "  ✅ Backend: psutil, memory-profiler, locust"
echo "  ✅ Database: performance analysis scripts"
echo "  ✅ Monitoring: system monitoring dashboard"
echo ""
echo "🚀 Next steps:"
echo "  1. Start your application (backend + frontend)"
echo "  2. Run: python scripts/monitor-performance.py"
echo "  3. Check the generated reports in ./reports/"
echo "  4. Review docs/performance/USAGE.md for detailed instructions"
echo ""
echo "📊 Performance monitoring is now active!" 