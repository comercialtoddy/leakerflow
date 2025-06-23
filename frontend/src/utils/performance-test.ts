// Performance testing utilities for React components
import React from 'react';
export interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  mountTime: number;
  updateTime: number;
  memoryUsage: number;
  virtualScrolling?: {
    visibleItems: number;
    totalItems: number;
    renderEfficiency: number;
  };
  searchPerformance?: {
    inputDelay: number;
    debounceDelay: number;
    filterTime: number;
  };
}

export class FrontendPerformanceTester {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) {
            console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
          }
        });
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        console.warn('Long task monitoring not supported');
      }

      // Monitor layout shifts
      const layoutShiftObserver = new PerformanceObserver((list) => {
        let cumulativeScore = 0;
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            cumulativeScore += entry.value;
          }
        });

        if (cumulativeScore > 0.1) {
          console.warn(`⚠️ High Cumulative Layout Shift: ${cumulativeScore.toFixed(4)}`);
        }
      });

      try {
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);
      } catch (e) {
        console.warn('Layout shift monitoring not supported');
      }
    }
  }

  // Test React component rendering performance
  measureComponentPerformance(componentName: string, renderFn: () => void): PerformanceMetrics {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    // Execute render function
    renderFn();

    const endTime = performance.now();
    const endMemory = this.getMemoryUsage();

    const metrics: PerformanceMetrics = {
      componentName,
      renderTime: endTime - startTime,
      mountTime: endTime - startTime, // Simplified for this example
      updateTime: 0,
      memoryUsage: endMemory - startMemory
    };

    this.metrics.set(componentName, metrics);
    return metrics;
  }

  // Test virtual scrolling performance
  testVirtualScrolling(
    componentName: string,
    totalItems: number,
    visibleItems: number,
    scrollTest: () => void
  ): void {
    const startTime = performance.now();
    
    scrollTest();
    
    const endTime = performance.now();
    const renderEfficiency = (visibleItems / totalItems) * 100;

    const existingMetrics = this.metrics.get(componentName);
    if (existingMetrics) {
      existingMetrics.virtualScrolling = {
        visibleItems,
        totalItems,
        renderEfficiency
      };
      this.metrics.set(componentName, existingMetrics);
    }

    console.log(`📊 Virtual Scrolling Performance:
      - Component: ${componentName}
      - Total Items: ${totalItems}
      - Visible Items: ${visibleItems}
      - Render Efficiency: ${renderEfficiency.toFixed(2)}%
      - Scroll Test Time: ${(endTime - startTime).toFixed(2)}ms`);
  }

  // Test search and filtering performance
  testSearchPerformance(
    componentName: string,
    searchTerm: string,
    dataSize: number,
    searchFn: (term: string) => any[]
  ): void {
    const inputStart = performance.now();
    
    // Simulate typing delay
    const inputDelay = Math.random() * 50 + 20; // 20-70ms typing delay
    
    setTimeout(() => {
      const filterStart = performance.now();
      const results = searchFn(searchTerm);
      const filterEnd = performance.now();

      const existingMetrics = this.metrics.get(componentName);
      if (existingMetrics) {
        existingMetrics.searchPerformance = {
          inputDelay,
          debounceDelay: 300, // Standard debounce delay
          filterTime: filterEnd - filterStart
        };
        this.metrics.set(componentName, existingMetrics);
      }

      console.log(`🔍 Search Performance:
        - Component: ${componentName}
        - Data Size: ${dataSize}
        - Results: ${results.length}
        - Filter Time: ${(filterEnd - filterStart).toFixed(2)}ms
        - Input Delay: ${inputDelay.toFixed(2)}ms`);
    }, inputDelay);
  }

  // Comprehensive component benchmark
  benchmarkComponent(
    componentName: string,
    testConfig: {
      renderCount: number;
      dataSize: number;
      searchTerms: string[];
      virtualScrolling?: {
        totalItems: number;
        containerHeight: number;
        itemHeight: number;
      };
    }
  ): Promise<PerformanceMetrics> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let totalRenderTime = 0;
      let renderCount = 0;

      const runRenderTest = () => {
        const renderStart = performance.now();
        
        // Simulate component render
        requestAnimationFrame(() => {
          const renderEnd = performance.now();
          totalRenderTime += renderEnd - renderStart;
          renderCount++;

          if (renderCount < testConfig.renderCount) {
            runRenderTest();
          } else {
            const avgRenderTime = totalRenderTime / renderCount;
            const totalTestTime = performance.now() - startTime;

            const metrics: PerformanceMetrics = {
              componentName,
              renderTime: avgRenderTime,
              mountTime: totalTestTime,
              updateTime: avgRenderTime,
              memoryUsage: this.getMemoryUsage()
            };

            // Test virtual scrolling if configured
            if (testConfig.virtualScrolling) {
              const { totalItems, containerHeight, itemHeight } = testConfig.virtualScrolling;
              const visibleItems = Math.ceil(containerHeight / itemHeight);
              
              metrics.virtualScrolling = {
                visibleItems,
                totalItems,
                renderEfficiency: (visibleItems / totalItems) * 100
              };
            }

            this.metrics.set(componentName, metrics);
            resolve(metrics);
          }
        });
      };

      runRenderTest();
    });
  }

  // Generate performance report
  generateReport(): string {
    const report = ['🚀 Frontend Performance Report', '='.repeat(50)];

    this.metrics.forEach((metrics, componentName) => {
      report.push(`\n📋 Component: ${componentName}`);
      report.push(`   Render Time: ${metrics.renderTime.toFixed(2)}ms`);
      report.push(`   Mount Time: ${metrics.mountTime.toFixed(2)}ms`);
      report.push(`   Memory Usage: ${metrics.memoryUsage.toFixed(2)}MB`);

      if (metrics.virtualScrolling) {
        report.push(`   Virtual Scrolling:`);
        report.push(`     - Visible Items: ${metrics.virtualScrolling.visibleItems}`);
        report.push(`     - Total Items: ${metrics.virtualScrolling.totalItems}`);
        report.push(`     - Efficiency: ${metrics.virtualScrolling.renderEfficiency.toFixed(2)}%`);
      }

      if (metrics.searchPerformance) {
        report.push(`   Search Performance:`);
        report.push(`     - Filter Time: ${metrics.searchPerformance.filterTime.toFixed(2)}ms`);
        report.push(`     - Debounce Delay: ${metrics.searchPerformance.debounceDelay}ms`);
      }

      // Performance rating
      const rating = this.getPerformanceRating(metrics);
      report.push(`   Rating: ${rating.emoji} ${rating.label}`);
    });

    return report.join('\n');
  }

  // Compare performance between components
  comparePerformance(component1: string, component2: string): string {
    const metrics1 = this.metrics.get(component1);
    const metrics2 = this.metrics.get(component2);

    if (!metrics1 || !metrics2) {
      return 'Cannot compare: one or both components not found';
    }

    const renderTimeImprovement = ((metrics1.renderTime - metrics2.renderTime) / metrics1.renderTime) * 100;
    const memoryImprovement = ((metrics1.memoryUsage - metrics2.memoryUsage) / metrics1.memoryUsage) * 100;

    return `📊 Performance Comparison: ${component1} vs ${component2}
      Render Time: ${renderTimeImprovement > 0 ? '✅' : '❌'} ${Math.abs(renderTimeImprovement).toFixed(1)}% ${renderTimeImprovement > 0 ? 'improvement' : 'regression'}
      Memory Usage: ${memoryImprovement > 0 ? '✅' : '❌'} ${Math.abs(memoryImprovement).toFixed(1)}% ${memoryImprovement > 0 ? 'improvement' : 'regression'}`;
  }

  // Memory usage helper
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
    }
    return 0;
  }

  // Performance rating system
  private getPerformanceRating(metrics: PerformanceMetrics): { emoji: string; label: string } {
    if (metrics.renderTime < 16) {
      return { emoji: '🚀', label: 'Excellent (60+ FPS)' };
    } else if (metrics.renderTime < 33) {
      return { emoji: '✅', label: 'Good (30+ FPS)' };
    } else if (metrics.renderTime < 50) {
      return { emoji: '⚠️', label: 'Fair (20+ FPS)' };
    } else {
      return { emoji: '❌', label: 'Poor (<20 FPS)' };
    }
  }

  // Web Vitals monitoring
  measureWebVitals(): Promise<{
    fcp: number; // First Contentful Paint
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
  }> {
    return new Promise((resolve) => {
      const vitals = { fcp: 0, lcp: 0, fid: 0, cls: 0 };

      // Measure FCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            vitals.fcp = entry.startTime;
          }
        });
      }).observe({ entryTypes: ['paint'] });

      // Measure LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        vitals.lcp = lastEntry.startTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // Measure FID
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          vitals.fid = entry.processingStart - entry.startTime;
        });
      }).observe({ entryTypes: ['first-input'] });

      // Measure CLS
      new PerformanceObserver((list) => {
        let clsScore = 0;
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsScore += entry.value;
          }
        });
        vitals.cls = clsScore;
      }).observe({ entryTypes: ['layout-shift'] });

      // Return results after a delay to allow measurements
      setTimeout(() => resolve(vitals), 3000);
    });
  }

  // Cleanup
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// Singleton instance
export const performanceTester = new FrontendPerformanceTester();

// React hook for component performance monitoring
export function usePerformanceMonitor(componentName: string) {
  React.useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (renderTime > 16) {
        console.warn(`⚡ Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    };
  }, [componentName]);
}

// Performance comparison utility
export function compareComponentPerformance(
  originalComponent: string,
  optimizedComponent: string
): void {
  console.log(performanceTester.comparePerformance(originalComponent, optimizedComponent));
} 