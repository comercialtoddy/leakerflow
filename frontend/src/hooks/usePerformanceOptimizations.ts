import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

// Performance optimization hook for React components
export function usePerformanceOptimizations() {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    // Log performance warnings in development
    if (process.env.NODE_ENV === 'development') {
      if (renderCount.current > 5 && timeSinceLastRender < 16) {
        console.warn('⚡ High render frequency detected. Consider memoization optimizations.');
      }
    }
  });

  return {
    renderCount: renderCount.current,
    timeSinceLastRender: Date.now() - lastRenderTime.current
  };
}

// Debounced search hook
export function useDebouncedSearch(searchTerm: string, delay: number = 300) {
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, delay]);

  return debouncedTerm;
}

// Memoized filter and sort hook
export function useFilterAndSort<T>(
  data: T[],
  filters: Record<string, any>,
  sortConfig: { key: keyof T; direction: 'asc' | 'desc' } | null,
  searchTerm?: string,
  searchFields?: (keyof T)[]
) {
  const debouncedSearchTerm = useDebouncedSearch(searchTerm || '', 300);

  return useMemo(() => {
    let filtered = [...data];

    // Apply search filter
    if (debouncedSearchTerm && searchFields) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        searchFields.some(field => {
          const value = item[field];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(searchLower);
          }
          if (Array.isArray(value)) {
            return value.some(v => 
              typeof v === 'string' && v.toLowerCase().includes(searchLower)
            );
          }
          return false;
        })
      );
    }

    // Apply other filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '') {
        filtered = filtered.filter(item => {
          const itemValue = item[key as keyof T];
          if (key.includes('Date') && typeof value === 'string') {
            // Handle date range filters
            const itemDate = new Date(itemValue as string);
            const filterDate = new Date(value);
            return key.includes('From') ? itemDate >= filterDate : itemDate <= filterDate;
          }
          return itemValue === value || (typeof itemValue === 'string' && itemValue.toLowerCase().includes(value.toLowerCase()));
        });
      }
    });

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
        
        return sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, filters, sortConfig, debouncedSearchTerm, searchFields]);
}

// Virtual scrolling hook for large lists
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index,
      offsetY: (visibleRange.start + index) * itemHeight
    }));
  }, [items, visibleRange, itemHeight]);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    visibleRange
  };
}

// Optimized pagination hook
export function usePagination<T>(
  data: T[],
  pageSize: number,
  initialPage: number = 1
) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(data.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, data.length);
    const paginatedItems = data.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      totalPages,
      currentPage,
      totalItems: data.length,
      startIndex: startIndex + 1,
      endIndex,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    };
  }, [data, pageSize, currentPage]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, paginationData.totalPages)));
  }, [paginationData.totalPages]);

  const nextPage = useCallback(() => {
    if (paginationData.hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [paginationData.hasNextPage]);

  const previousPage = useCallback(() => {
    if (paginationData.hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [paginationData.hasPreviousPage]);

  // Reset to first page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  return {
    ...paginationData,
    goToPage,
    nextPage,
    previousPage,
    setPageSize: useCallback((size: number) => {
      setCurrentPage(1);
      // Note: pageSize should be managed by parent component
    }, [])
  };
}

// Performance monitoring for components
export function useComponentPerformance(componentName: string) {
  const renderTime = useRef(Date.now());
  const mountTime = useRef(Date.now());

  useEffect(() => {
    mountTime.current = Date.now();
    
    return () => {
      const unmountTime = Date.now();
      const totalLifetime = unmountTime - mountTime.current;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 ${componentName} lifetime: ${totalLifetime}ms`);
      }
    };
  }, [componentName]);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastRender = now - renderTime.current;
    renderTime.current = now;

    if (process.env.NODE_ENV === 'development' && timeSinceLastRender < 16) {
      console.warn(`⚡ ${componentName}: Fast re-render detected (${timeSinceLastRender}ms)`);
    }
  });
}

// Memoized handlers factory
export function useOptimizedHandlers() {
  return {
    // Memoized click handler factory
    createClickHandler: useCallback((handler: (id: string | number) => void) => {
      return useCallback((id: string | number) => handler(id), [handler]);
    }, []),

    // Memoized form handler factory
    createFormHandler: useCallback((handler: (field: string, value: any) => void) => {
      return useCallback((field: string) => 
        useCallback((value: any) => handler(field, value), [field, handler]),
      [handler]);
    }, []),

    // Memoized async handler factory
    createAsyncHandler: useCallback((
      handler: (...args: any[]) => Promise<void>,
      loadingState?: [boolean, (loading: boolean) => void]
    ) => {
      return useCallback(async (...args: any[]) => {
        if (loadingState) {
          loadingState[1](true);
        }
        
        try {
          await handler(...args);
        } catch (error) {
          console.error('Async handler error:', error);
        } finally {
          if (loadingState) {
            loadingState[1](false);
          }
        }
      }, [handler, loadingState]);
    }, [])
  };
}

// Intersection observer hook for lazy loading
export function useIntersectionObserver(
  targetRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      if (entry.isIntersecting && !hasIntersected) {
        setHasIntersected(true);
      }
    }, options);

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, options, hasIntersected]);

  return { isIntersecting, hasIntersected };
} 