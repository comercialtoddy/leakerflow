/**
 * Frontend Performance Monitoring for Leaker-Flow
 * =============================================
 * 
 * Comprehensive performance monitoring for React/Next.js application
 * including Web Vitals, component performance, and user interaction tracking.
 */

import { onCLS, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';
import React from 'react';

// Performance targets based on Google's recommendations
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
  
  // Additional metrics
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
} as const;

export type PerformanceMetricName = keyof typeof PERFORMANCE_THRESHOLDS;

export interface PerformanceReport {
  timestamp: string;
  url: string;
  userAgent: string;
  metrics: {
    [key in PerformanceMetricName]?: {
      value: number;
      rating: 'good' | 'needs-improvement' | 'poor';
      delta?: number;
    };
  };
  customMetrics: Record<string, any>;
  navigationTiming?: PerformanceNavigationTiming;
  resourceTiming?: PerformanceResourceTiming[];
}

class PerformanceMonitor {
  private reports: PerformanceReport[] = [];
  private customMetrics: Record<string, any> = {};
  private isEnabled: boolean = true;
  
  constructor() {
    if (typeof window === 'undefined') {
      this.isEnabled = false;
      return;
    }
    
    this.initWebVitals();
    this.initNavigationObserver();
  }
  
  /**
   * Initialize Web Vitals monitoring
   */
  private initWebVitals(): void {
    const handleMetric = (metric: Metric) => {
      this.recordMetric(metric.name as PerformanceMetricName, metric.value, metric.delta);
      
      // Log performance issues
      const rating = this.getMetricRating(metric.name as PerformanceMetricName, metric.value);
      if (rating === 'poor') {
        console.warn(`🐌 Poor ${metric.name} performance:`, {
          value: metric.value,
          rating,
          metric
        });
      } else if (rating === 'needs-improvement') {
        console.info(`⚠️ ${metric.name} needs improvement:`, {
          value: metric.value,
          rating,
          metric
        });
      }
    };
    
    // Core Web Vitals
    onCLS(handleMetric);
    onLCP(handleMetric);
    
    // Additional metrics
    onFCP(handleMetric);
    onTTFB(handleMetric);
  }
  
  /**
   * Initialize navigation and resource timing observers
   */
  private initNavigationObserver(): void {
    if (!('PerformanceObserver' in window)) return;
    
    // Navigation timing observer
    const navObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'navigation') {
          this.recordNavigationTiming(entry as PerformanceNavigationTiming);
        }
      });
    });
    
    try {
      navObserver.observe({ entryTypes: ['navigation'] });
    } catch (e) {
      console.warn('Navigation timing observer not supported');
    }
    
    // Resource timing observer
    const resourceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'resource') {
          this.recordResourceTiming(entry as PerformanceResourceTiming);
        }
      });
    });
    
    try {
      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (e) {
      console.warn('Resource timing observer not supported');
    }
  }
  
  /**
   * Record a performance metric
   */
  private recordMetric(name: PerformanceMetricName, value: number, delta?: number): void {
    if (!this.isEnabled) return;
    
    const rating = this.getMetricRating(name, value);
    
    const currentReport = this.getCurrentReport();
    currentReport.metrics[name] = {
      value,
      rating,
      delta
    };
    
    // Emit custom event for real-time monitoring
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-metric', {
        detail: { name, value, rating, delta }
      }));
    }
  }
  
  /**
   * Get metric rating based on thresholds
   */
  private getMetricRating(name: PerformanceMetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = PERFORMANCE_THRESHOLDS[name];
    if (!thresholds) return 'good';
    
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  }
  
  /**
   * Record navigation timing data
   */
  private recordNavigationTiming(timing: PerformanceNavigationTiming): void {
    const currentReport = this.getCurrentReport();
    currentReport.navigationTiming = timing;
    
    // Calculate custom timing metrics
    const customTimings = {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
      domComplete: timing.domComplete - timing.startTime,
      loadComplete: timing.loadEventEnd - timing.loadEventStart,
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnection: timing.connectEnd - timing.connectStart,
      serverResponse: timing.responseEnd - timing.requestStart,
      domProcessing: timing.domComplete - timing.responseEnd,
    };
    
    Object.entries(customTimings).forEach(([key, value]) => {
      this.addCustomMetric(`navigation.${key}`, value);
    });
  }
  
  /**
   * Record resource timing data
   */
  private recordResourceTiming(timing: PerformanceResourceTiming): void {
    const currentReport = this.getCurrentReport();
    if (!currentReport.resourceTiming) {
      currentReport.resourceTiming = [];
    }
    currentReport.resourceTiming.push(timing);
    
    // Analyze slow resources
    const duration = timing.responseEnd - timing.startTime;
    if (duration > 1000) { // Slow resource threshold: 1 second
      console.warn(`🐌 Slow resource loading:`, {
        name: timing.name,
        duration: `${duration.toFixed(2)}ms`,
        size: timing.transferSize ? `${(timing.transferSize / 1024).toFixed(2)}KB` : 'unknown'
      });
    }
  }
  
  /**
   * Get or create current performance report
   */
  private getCurrentReport(): PerformanceReport {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    
    // Check if we have a recent report for the current URL
    const existingReport = this.reports.find(report => 
      report.url === url && 
      Date.now() - new Date(report.timestamp).getTime() < 30000 // 30 seconds
    );
    
    if (existingReport) {
      return existingReport;
    }
    
    // Create new report
    const newReport: PerformanceReport = {
      timestamp: new Date().toISOString(),
      url,
      userAgent,
      metrics: {},
      customMetrics: { ...this.customMetrics }
    };
    
    this.reports.push(newReport);
    return newReport;
  }
  
  /**
   * Add custom metric
   */
  public addCustomMetric(name: string, value: any): void {
    this.customMetrics[name] = value;
    const currentReport = this.getCurrentReport();
    currentReport.customMetrics[name] = value;
  }
  
  /**
   * Mark component render start
   */
  public markComponentRenderStart(componentName: string): void {
    if (!this.isEnabled) return;
    performance.mark(`${componentName}-render-start`);
  }
  
  /**
   * Mark component render end and measure duration
   */
  public markComponentRenderEnd(componentName: string): number | null {
    if (!this.isEnabled) return null;
    
    const endMark = `${componentName}-render-end`;
    const startMark = `${componentName}-render-start`;
    
    performance.mark(endMark);
    
    try {
      const measure = performance.measure(`${componentName}-render`, startMark, endMark);
      const duration = measure.duration;
      
      this.addCustomMetric(`component.${componentName}.renderTime`, duration);
      
      // Log slow component renders
      if (duration > 16) { // 60 FPS threshold
        console.warn(`🐌 Slow component render:`, {
          component: componentName,
          duration: `${duration.toFixed(2)}ms`
        });
      }
      
      return duration;
    } catch (error) {
      console.warn(`Could not measure ${componentName} render time:`, error);
      return null;
    }
  }
  
  /**
   * Track user interaction timing
   */
  public trackInteraction(actionName: string, startTime?: number): () => void {
    if (!this.isEnabled) return () => {};
    
    const start = startTime || performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.addCustomMetric(`interaction.${actionName}`, duration);
      
      // Log slow interactions
      if (duration > 100) { // Interaction should be < 100ms for good UX
        console.warn(`🐌 Slow interaction:`, {
          action: actionName,
          duration: `${duration.toFixed(2)}ms`
        });
      }
    };
  }
  
  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    overall: 'good' | 'needs-improvement' | 'poor';
    metrics: PerformanceReport['metrics'];
    issues: string[];
    recommendations: string[];
  } {
    const currentReport = this.getCurrentReport();
    const metrics = currentReport.metrics;
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    let poorCount = 0;
    let needsImprovementCount = 0;
    
    Object.entries(metrics).forEach(([name, data]) => {
      if (data?.rating === 'poor') {
        poorCount++;
        issues.push(`${name}: ${data.value.toFixed(2)}ms (poor)`);
        
        // Add specific recommendations
        switch (name) {
          case 'LCP':
            recommendations.push('Optimize largest content element loading (images, fonts)');
            break;
          case 'FID':
            recommendations.push('Reduce JavaScript execution time and main thread blocking');
            break;
          case 'CLS':
            recommendations.push('Avoid layout shifts by setting dimensions for images/videos');
            break;
          case 'FCP':
            recommendations.push('Optimize critical rendering path and reduce render-blocking resources');
            break;
          case 'TTFB':
            recommendations.push('Optimize server response time and use CDN');
            break;
        }
      } else if (data?.rating === 'needs-improvement') {
        needsImprovementCount++;
        issues.push(`${name}: ${data.value.toFixed(2)}ms (needs improvement)`);
      }
    });
    
    let overall: 'good' | 'needs-improvement' | 'poor';
    if (poorCount > 0) {
      overall = 'poor';
    } else if (needsImprovementCount > 0) {
      overall = 'needs-improvement';
    } else {
      overall = 'good';
    }
    
    return {
      overall,
      metrics,
      issues,
      recommendations
    };
  }
  
  /**
   * Export performance data for analysis
   */
  public exportData(): PerformanceReport[] {
    return [...this.reports];
  }
  
  /**
   * Send performance data to analytics endpoint
   */
  public async sendToAnalytics(endpoint: string = '/api/analytics/performance'): Promise<void> {
    if (!this.isEnabled || this.reports.length === 0) return;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reports: this.reports,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }),
      });
      
      if (response.ok) {
        console.info('📊 Performance data sent to analytics');
        this.reports = []; // Clear sent reports
      } else {
        console.warn('Failed to send performance data:', response.statusText);
      }
    } catch (error) {
      console.warn('Error sending performance data:', error);
    }
  }
  
  /**
   * Enable/disable performance monitoring
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

// React hook for component performance monitoring
export function usePerformanceMonitor() {
  const monitor = getPerformanceMonitor();
  
  const trackRender = (componentName: string) => {
    const startTime = performance.now();
    monitor.markComponentRenderStart(componentName);
    
    return () => {
      monitor.markComponentRenderEnd(componentName);
    };
  };
  
  const trackInteraction = (actionName: string) => {
    return monitor.trackInteraction(actionName);
  };
  
  const addCustomMetric = (name: string, value: any) => {
    monitor.addCustomMetric(name, value);
  };
  
  return {
    trackRender,
    trackInteraction,
    addCustomMetric,
    getPerformanceSummary: () => monitor.getPerformanceSummary(),
  };
}

// HOC for automatic component performance monitoring
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const ComponentWithPerformanceMonitoring = (props: P) => {
    const { trackRender } = usePerformanceMonitor();
    const name = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Unknown';
    
    React.useEffect(() => {
      const endTracking = trackRender(name);
      return endTracking;
    }, []);
    
    return React.createElement(WrappedComponent, props);
  };
  
  ComponentWithPerformanceMonitoring.displayName = `withPerformanceMonitoring(${componentName || WrappedComponent.displayName || WrappedComponent.name})`;
  
  return ComponentWithPerformanceMonitoring;
}

// Singleton performance monitor instance
let performanceMonitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor();
  }
  return performanceMonitorInstance;
}

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  // Start monitoring immediately
  getPerformanceMonitor();
  
  // Send data periodically (every 5 minutes)
  setInterval(() => {
    getPerformanceMonitor().sendToAnalytics();
  }, 5 * 60 * 1000);
  
  // Send data when page is about to unload
  window.addEventListener('beforeunload', () => {
    getPerformanceMonitor().sendToAnalytics();
  });
}

export default PerformanceMonitor; 