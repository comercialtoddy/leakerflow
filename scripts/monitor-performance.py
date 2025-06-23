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
import os
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
        
        # Network I/O
        try:
            network = psutil.net_io_counters()
            network_data = {
                'bytes_sent': network.bytes_sent,
                'bytes_recv': network.bytes_recv,
                'packets_sent': network.packets_sent,
                'packets_recv': network.packets_recv
            }
        except:
            network_data = {
                'bytes_sent': 0,
                'bytes_recv': 0,
                'packets_sent': 0,
                'packets_recv': 0
            }
        
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
            'network': network_data,
            'processes': len(psutil.pids())
        }
    
    def check_backend_health(self) -> Dict[str, Any]:
        """Check backend API health"""
        try:
            import requests
            start_time = time.time()
            response = requests.get('http://localhost:8000/health', timeout=5)
            response_time = (time.time() - start_time) * 1000
            
            return {
                'status': 'healthy' if response.status_code == 200 else 'unhealthy',
                'response_time': response_time,
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
            start_time = time.time()
            response = requests.get('http://localhost:3000', timeout=5)
            response_time = (time.time() - start_time) * 1000
            
            return {
                'status': 'healthy' if response.status_code == 200 else 'unhealthy',
                'response_time': response_time,
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
                  f"Backend: {backend['status']} | "
                  f"Frontend: {frontend['status']}")
            
            # Show response times if available
            if backend.get('response_time'):
                print(f"   Backend Response: {backend['response_time']:.1f}ms")
            if frontend.get('response_time'):
                print(f"   Frontend Response: {frontend['response_time']:.1f}ms")
            
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
                'duration_minutes': len(self.metrics_history) * (30 / 60),  # Convert 30s intervals to minutes
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
    print("🚀 Leaker-Flow Performance Monitor")
    print("==================================")
    
    # Check for command line arguments
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    
    # Create reports directory if it doesn't exist
    os.makedirs('reports', exist_ok=True)
    
    monitor = SystemMonitor()
    report = monitor.monitor_loop(duration_minutes=duration)
    
    # Save report
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_file = f'reports/performance_report_{timestamp}.json'
    
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
        print(f"   Backend Availability: {report['api_performance']['backend']['availability']:.1f}%")
        
    if report['api_performance']['frontend']['average_response_time']:
        print(f"   Frontend Avg: {report['api_performance']['frontend']['average_response_time']:.1f}ms")
        print(f"   Frontend Availability: {report['api_performance']['frontend']['availability']:.1f}%")
    
    print(f"\nℹ️  To view detailed metrics, open: {report_file}")

if __name__ == '__main__':
    main() 