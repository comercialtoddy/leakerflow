import React, { Suspense, lazy, memo, useRef } from 'react';
import { useIntersectionObserver } from '@/hooks/usePerformanceOptimizations';

// Loading fallback components
export const TableSkeleton = memo(() => (
  <div className="space-y-4">
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-4 bg-muted animate-pulse rounded" />
      ))}
    </div>
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, j) => (
          <div key={j} className="h-8 bg-muted/60 animate-pulse rounded" />
        ))}
      </div>
    ))}
  </div>
));

export const CardSkeleton = memo(() => (
  <div className="space-y-4 p-6 rounded-lg border">
    <div className="flex items-center space-x-4">
      <div className="h-12 w-12 bg-muted animate-pulse rounded-full" />
      <div className="space-y-2">
        <div className="h-4 bg-muted animate-pulse rounded w-32" />
        <div className="h-3 bg-muted/60 animate-pulse rounded w-24" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-3 bg-muted/60 animate-pulse rounded w-full" />
      <div className="h-3 bg-muted/60 animate-pulse rounded w-3/4" />
      <div className="h-3 bg-muted/60 animate-pulse rounded w-1/2" />
    </div>
  </div>
));

export const StatsSkeleton = memo(() => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="p-6 rounded-lg border space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 bg-muted animate-pulse rounded w-20" />
            <div className="h-6 bg-muted animate-pulse rounded w-12" />
          </div>
          <div className="h-8 w-8 bg-muted animate-pulse rounded" />
        </div>
      </div>
    ))}
  </div>
));

export const PanelSkeleton = memo(() => (
  <div className="space-y-6">
    {/* Header skeleton */}
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-8 bg-muted animate-pulse rounded w-48" />
        <div className="h-4 bg-muted/60 animate-pulse rounded w-32" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
      </div>
    </div>

    {/* Stats skeleton */}
    <StatsSkeleton />

    {/* Controls skeleton */}
    <div className="flex gap-4">
      <div className="h-10 w-64 bg-muted animate-pulse rounded" />
      <div className="h-10 w-32 bg-muted animate-pulse rounded" />
      <div className="h-10 w-32 bg-muted animate-pulse rounded" />
    </div>

    {/* Table skeleton */}
    <TableSkeleton />
  </div>
));

// Intersection observer wrapper for lazy loading
interface LazyComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
  className?: string;
}

export const LazyComponent = memo(({
  children,
  fallback = <div className="h-32 flex items-center justify-center">Loading...</div>,
  rootMargin = '100px',
  threshold = 0.1,
  className = ''
}: LazyComponentProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { hasIntersected } = useIntersectionObserver(ref, {
    rootMargin,
    threshold
  });

  return (
    <div ref={ref} className={className}>
      {hasIntersected ? children : fallback}
    </div>
  );
});

LazyComponent.displayName = 'LazyComponent';

// Enhanced Suspense wrapper with error boundary
interface OptimizedSuspenseProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export const OptimizedSuspense = memo(({
  children,
  fallback = <div className="flex items-center justify-center h-32">Loading...</div>,
  errorFallback = <div className="flex items-center justify-center h-32 text-destructive">Failed to load component</div>
}: OptimizedSuspenseProps) => (
  <ErrorBoundary fallback={errorFallback}>
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  </ErrorBoundary>
));

OptimizedSuspense.displayName = 'OptimizedSuspense';

// Lazy admin component loaders with performance optimizations
export const LazyAuthorApplicationsPanel = lazy(() => 
  import('@/components/admin/AuthorApplicationsPanel').then(module => ({
    default: module.AuthorApplicationsPanel
  }))
);

export const LazyAuthorManagementPanel = lazy(() =>
  import('@/components/admin/AuthorManagementPanel').then(module => ({
    default: module.AuthorManagementPanel
  }))
);

export const LazyArticleManagementPanel = lazy(() =>
  import('@/components/admin/ArticleManagementPanel').then(module => ({
    default: module.ArticleManagementPanel
  }))
);

export const LazyAnalyticsPanel = lazy(() =>
  import('@/components/admin/AnalyticsPanel').then(module => ({
    default: module.AnalyticsPanel
  }))
);

// Preload functions for better UX
export const preloadAdminComponents = () => {
  // Preload all admin components in the background
  const preloadPromises = [
    import('@/components/admin/AuthorApplicationsPanel'),
    import('@/components/admin/AuthorManagementPanel'),
    import('@/components/admin/ArticleManagementPanel'),
    import('@/components/admin/AnalyticsPanel')
  ];
  
  return Promise.allSettled(preloadPromises);
};

// Utility component for progressive enhancement
interface ProgressiveEnhancementProps {
  children: React.ReactNode;
  enhanced: React.ReactNode;
  threshold?: number;
  delay?: number;
}

export const ProgressiveEnhancement = memo(({
  children,
  enhanced,
  threshold = 0.1,
  delay = 100
}: ProgressiveEnhancementProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { hasIntersected } = useIntersectionObserver(ref, { threshold });
  const [shouldEnhance, setShouldEnhance] = React.useState(false);

  React.useEffect(() => {
    if (hasIntersected) {
      const timer = setTimeout(() => {
        setShouldEnhance(true);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [hasIntersected, delay]);

  return (
    <div ref={ref}>
      {shouldEnhance ? enhanced : children}
    </div>
  );
});

ProgressiveEnhancement.displayName = 'ProgressiveEnhancement';

// Higher-order component for lazy loading with caching
export function withLazyLoading<P extends object>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc);
  
  return memo((props: P) => (
    <OptimizedSuspense fallback={fallback}>
      <LazyComponent {...props} />
    </OptimizedSuspense>
  ));
}

// Image lazy loading component
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  threshold?: number;
}

export const LazyImage = memo(({
  src,
  alt,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PC9zdmc+',
  className = '',
  threshold = 0.1,
  ...props
}: LazyImageProps) => {
  const ref = useRef<HTMLImageElement>(null);
  const { hasIntersected } = useIntersectionObserver(ref, { threshold });
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  return (
    <img
      ref={ref}
      src={hasIntersected ? src : placeholder}
      alt={alt}
      className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      {...props}
    />
  );
});

LazyImage.displayName = 'LazyImage'; 