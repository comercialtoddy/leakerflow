# Performance Tools Setup Script for Leaker-Flow (PowerShell)
# ==========================================================
# 
# This script installs and configures all performance monitoring tools
# for the Leaker-Flow application stack on Windows.

# Enable strict mode for better error handling
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Performance Monitoring Tools for Leaker-Flow" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Function to print colored output
function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param($Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

# Check if we're in the correct directory
if (-not (Test-Path "package.json") -or -not (Test-Path "backend/requirements.txt")) {
    Write-Error "Please run this script from the project root directory"
    exit 1
}

Write-Info "Project structure verified"

# 1. Frontend Performance Tools Setup
Write-Host "`n📦 Installing Frontend Performance Tools" -ForegroundColor Blue
Write-Host "=========================================" -ForegroundColor Blue

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Info "Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js first."
    exit 1
}

# Install frontend performance dependencies
Write-Info "Installing web-vitals and performance analysis tools..."
Set-Location frontend

# Core performance monitoring packages
npm install web-vitals

# Development tools for performance analysis
npm install --save-dev @next/bundle-analyzer
npm install --save-dev lighthouse
npm install --save-dev webpack-bundle-analyzer

Write-Success "Frontend performance tools installed"

# Configure bundle analyzer for Next.js
Write-Info "Configuring Next.js bundle analyzer..."

$nextConfigContent = @"
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
"@

$nextConfigContent | Out-File -FilePath "next.config.js" -Encoding UTF8

Write-Success "Next.js configuration updated"

# Install lighthouse globally if not present
try {
    lighthouse --version | Out-Null
    Write-Info "Lighthouse already installed"
} catch {
    Write-Info "Installing Lighthouse globally..."
    npm install -g lighthouse
}

Set-Location ..

# 2. Backend Performance Tools Setup
Write-Host "`n🐍 Installing Backend Performance Tools" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

# Check if Python is installed
try {
    $pythonVersion = python --version
    Write-Info "Python version: $pythonVersion"
} catch {
    Write-Error "Python is not installed. Please install Python first."
    exit 1
}

Set-Location backend

# Install backend performance monitoring packages
Write-Info "Installing Python performance monitoring packages..."

# Install performance monitoring packages
pip install psutil memory-profiler py-spy locust sqlalchemy-utils

Write-Success "Backend performance tools installed"

Set-Location ..

# 3. Create Performance Monitoring Scripts
Write-Host "`n📊 Creating Performance Monitoring Scripts" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue

# Create directories
New-Item -ItemType Directory -Force -Path "scripts", "reports", "docs/performance" | Out-Null

# Create performance monitoring script
$monitoringScript = @"
#!/usr/bin/env python3
"""
Performance Monitoring Script for Leaker-Flow
============================================

Monitors system performance and generates reports.
"""

import psutil
import time
import json
import sys
from datetime import datetime
from typing import Dict, List, Any

class SystemMonitor:
    def __init__(self):
        self.start_time = time.time()
        self.metrics_history = []
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get current system performance metrics"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('.')
        
        return {
            'timestamp': datetime.now().isoformat(),
            'cpu': {
                'percent': cpu_percent,
                'count': psutil.cpu_count(),
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
            'processes': len(psutil.pids())
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
    
    def monitor_loop(self, duration_minutes: int = 5, interval_seconds: int = 30):
        """Run monitoring loop"""
        end_time = time.time() + (duration_minutes * 60)
        
        print(f"🔍 Starting performance monitoring for {duration_minutes} minutes...")
        print(f"📊 Collecting metrics every {interval_seconds} seconds")
        print("=" * 60)
        
        while time.time() < end_time:
            metrics = {
                'system': self.get_system_metrics(),
                'backend': self.check_backend_health()
            }
            
            self.metrics_history.append(metrics)
            
            # Print current status
            system = metrics['system']
            backend = metrics['backend']
            
            print(f"⏰ {datetime.now().strftime('%H:%M:%S')} | "
                  f"CPU: {system['cpu']['percent']:.1f}% | "
                  f"RAM: {system['memory']['percent']:.1f}% | "
                  f"Backend: {backend['status']}")
            
            time.sleep(interval_seconds)
        
        return self.generate_report()
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate performance report"""
        if not self.metrics_history:
            return {'error': 'No metrics collected'}
        
        # Calculate averages
        cpu_values = [m['system']['cpu']['percent'] for m in self.metrics_history]
        memory_values = [m['system']['memory']['percent'] for m in self.metrics_history]
        
        report = {
            'monitoring_period': {
                'start': self.metrics_history[0]['system']['timestamp'],
                'end': self.metrics_history[-1]['system']['timestamp'],
                'duration_minutes': len(self.metrics_history) * 0.5,
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
            'alerts': []
        }
        
        # Generate alerts
        if report['system_performance']['cpu']['average'] > 80:
            report['alerts'].append('High CPU usage detected')
        if report['system_performance']['memory']['average'] > 80:
            report['alerts'].append('High memory usage detected')
        
        return report

def main():
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    
    monitor = SystemMonitor()
    report = monitor.monitor_loop(duration_minutes=duration)
    
    # Save report
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_file = f'reports/performance_report_{timestamp}.json'
    
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"`n📊 Performance Report Generated: {report_file}")
    print("=" * 60)
    
    # Print summary
    if 'alerts' in report and report['alerts']:
        print("⚠️  ALERTS:")
        for alert in report['alerts']:
            print(f"   - {alert}")
    else:
        print("✅ No performance issues detected")
    
    print(f"`n📈 SYSTEM PERFORMANCE:")
    print(f"   CPU Average: {report['system_performance']['cpu']['average']:.1f}%")
    print(f"   Memory Average: {report['system_performance']['memory']['average']:.1f}%")

if __name__ == '__main__':
    main()
"@

$monitoringScript | Out-File -FilePath "scripts/monitor-performance.py" -Encoding UTF8

Write-Success "Performance monitoring script created"

# Create usage documentation
$usageDoc = @"
# Performance Monitoring Usage Guide

## Quick Start

### 1. Backend Performance Profiling

```powershell
# Start backend with performance profiling enabled
cd backend
$env:ENABLE_PERFORMANCE_PROFILING = "true"
python -m uvicorn main:app --reload

# Monitor performance in real-time (in another terminal)
python scripts/monitor-performance.py 10  # Monitor for 10 minutes
```

### 2. Frontend Performance Analysis

```powershell
# Run bundle analysis
cd frontend
npm run build
$env:ANALYZE = "true"
npm run build

# Run Lighthouse performance audit
lighthouse http://localhost:3000 --output=html --output-path=../reports/lighthouse.html
```

### 3. Load Testing

```powershell
# Start the application first
cd backend
python -m uvicorn main:app --reload

# In another terminal, run load tests
cd backend
locust -f tests/load_test.py --host=http://localhost:8000 --users 10 --spawn-rate 2 --run-time 300s
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

## Reports

Performance reports are saved in the `reports/` directory:
- `lighthouse.html` - Lighthouse audit reports
- `performance_report_*.json` - System monitoring reports
"@

$usageDoc | Out-File -FilePath "docs/performance/USAGE.md" -Encoding UTF8

Write-Success "Usage documentation created"

# Final setup
Write-Host "`n🔧 Final Setup" -ForegroundColor Blue
Write-Host "===============" -ForegroundColor Blue

# Install requests for Python monitoring
pip install requests

Write-Success "Performance tools setup completed!"

Write-Host "`n🎉 Performance Monitoring Setup Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 What was installed:" -ForegroundColor White
Write-Host "  ✅ Frontend: web-vitals, lighthouse, bundle-analyzer" -ForegroundColor Green
Write-Host "  ✅ Backend: psutil, memory-profiler, locust" -ForegroundColor Green
Write-Host "  ✅ Monitoring: system monitoring script" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor White
Write-Host "  1. Start your application (backend + frontend)" -ForegroundColor White
Write-Host "  2. Run: python scripts/monitor-performance.py" -ForegroundColor White
Write-Host "  3. Check the generated reports in ./reports/" -ForegroundColor White
Write-Host "  4. Review docs/performance/USAGE.md for detailed instructions" -ForegroundColor White
Write-Host ""
Write-Host "📊 Performance monitoring is now active!" -ForegroundColor Cyan 