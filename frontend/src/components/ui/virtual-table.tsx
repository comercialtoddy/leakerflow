import React, { memo, useCallback, useMemo } from 'react';
import { useVirtualScrolling } from '@/hooks/usePerformanceOptimizations';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Column<T> {
  key: keyof T;
  header: string;
  width?: number;
  render?: (value: any, item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  containerHeight?: number;
  overscan?: number;
  onRowClick?: (item: T, index: number) => void;
  rowClassName?: (item: T, index: number) => string;
  sortField?: keyof T;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: keyof T) => void;
  emptyMessage?: string;
  loading?: boolean;
  selectedRows?: Set<string | number>;
  onRowSelect?: (id: string | number, selected: boolean) => void;
  getRowId?: (item: T) => string | number;
}

// Memoized table row component to prevent unnecessary re-renders
const VirtualTableRow = memo(<T,>({
  item,
  index,
  columns,
  offsetY,
  onRowClick,
  rowClassName,
  selectedRows,
  onRowSelect,
  getRowId
}: {
  item: T;
  index: number;
  columns: Column<T>[];
  offsetY: number;
  onRowClick?: (item: T, index: number) => void;
  rowClassName?: (item: T, index: number) => string;
  selectedRows?: Set<string | number>;
  onRowSelect?: (id: string | number, selected: boolean) => void;
  getRowId?: (item: T) => string | number;
}) => {
  const rowId = getRowId?.(item);
  const isSelected = rowId ? selectedRows?.has(rowId) : false;

  const handleClick = useCallback(() => {
    onRowClick?.(item, index);
  }, [onRowClick, item, index]);

  const handleSelectChange = useCallback((checked: boolean) => {
    if (rowId && onRowSelect) {
      onRowSelect(rowId, checked);
    }
  }, [rowId, onRowSelect]);

  const className = useMemo(() => {
    let classes = 'absolute w-full hover:bg-muted/50 transition-colors';
    if (rowClassName) {
      classes += ` ${rowClassName(item, index)}`;
    }
    if (isSelected) {
      classes += ' bg-muted';
    }
    if (onRowClick) {
      classes += ' cursor-pointer';
    }
    return classes;
  }, [rowClassName, item, index, isSelected, onRowClick]);

  return (
    <TableRow
      className={className}
      style={{ transform: `translateY(${offsetY}px)` }}
      onClick={handleClick}
    >
      {onRowSelect && (
        <TableCell className="w-12">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleSelectChange(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-input"
          />
        </TableCell>
      )}
      {columns.map((column) => {
        const value = item[column.key];
        const content = column.render ? column.render(value, item, index) : String(value);
        
        return (
          <TableCell
            key={String(column.key)}
            className={column.className}
            style={{ width: column.width }}
          >
            {content}
          </TableCell>
        );
      })}
    </TableRow>
  );
});

VirtualTableRow.displayName = 'VirtualTableRow';

// Memoized table header component
const VirtualTableHeader = memo(<T,>({
  columns,
  sortField,
  sortDirection,
  onSort,
  hasSelection
}: {
  columns: Column<T>[];
  sortField?: keyof T;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: keyof T) => void;
  hasSelection?: boolean;
}) => {
  const handleSort = useCallback((field: keyof T) => {
    if (onSort) {
      onSort(field);
    }
  }, [onSort]);

  return (
    <TableHeader>
      <TableRow>
        {hasSelection && (
          <TableHead className="w-12">
            <input
              type="checkbox"
              className="rounded border border-input"
              onChange={() => {}} // Placeholder for select all functionality
            />
          </TableHead>
        )}
        {columns.map((column) => (
          <TableHead
            key={String(column.key)}
            className={`${column.className} ${column.sortable && onSort ? 'cursor-pointer hover:bg-muted/50' : ''}`}
            style={{ width: column.width }}
            onClick={column.sortable && onSort ? () => handleSort(column.key) : undefined}
          >
            <div className="flex items-center gap-2">
              {column.header}
              {column.sortable && sortField === column.key && (
                <span className="text-xs">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
});

VirtualTableHeader.displayName = 'VirtualTableHeader';

// Main virtual table component
export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 60,
  containerHeight = 400,
  overscan = 5,
  onRowClick,
  rowClassName,
  sortField,
  sortDirection,
  onSort,
  emptyMessage = 'No data available',
  loading = false,
  selectedRows,
  onRowSelect,
  getRowId
}: VirtualTableProps<T>) {
  const {
    visibleItems,
    totalHeight,
    handleScroll,
    visibleRange
  } = useVirtualScrolling(data, rowHeight, containerHeight, overscan);

  const hasSelection = Boolean(onRowSelect);

  const tableStyle = useMemo(() => ({
    height: containerHeight,
    overflow: 'auto'
  }), [containerHeight]);

  const bodyStyle = useMemo(() => ({
    height: totalHeight,
    position: 'relative' as const
  }), [totalHeight]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <div style={tableStyle} onScroll={handleScroll}>
        <Table>
          <VirtualTableHeader
            columns={columns}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={onSort}
            hasSelection={hasSelection}
          />
          <TableBody style={bodyStyle}>
            {visibleItems.map(({ item, index, offsetY }) => (
              <VirtualTableRow
                key={getRowId ? getRowId(item) : index}
                item={item}
                index={index}
                columns={columns}
                offsetY={offsetY}
                onRowClick={onRowClick}
                rowClassName={rowClassName}
                selectedRows={selectedRows}
                onRowSelect={onRowSelect}
                getRowId={getRowId}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Render info */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-t">
        Showing {visibleRange.start + 1}-{Math.min(visibleRange.end, data.length)} of {data.length} items
        {process.env.NODE_ENV === 'development' && (
          <span className="ml-4">
            (Rendered: {visibleItems.length} rows)
          </span>
        )}
      </div>
    </div>
  );
}

// Additional optimized list component for simpler data
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemId?: (item: T) => string | number;
  className?: string;
  emptyMessage?: string;
  loading?: boolean;
}

export const VirtualList = memo(<T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  getItemId,
  className = '',
  emptyMessage = 'No items',
  loading = false
}: VirtualListProps<T>) => {
  const {
    visibleItems,
    totalHeight,
    handleScroll
  } = useVirtualScrolling(items, itemHeight, containerHeight);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, offsetY }) => (
          <div
            key={getItemId ? getItemId(item) : index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: itemHeight,
              transform: `translateY(${offsetY}px)`
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
});

VirtualList.displayName = 'VirtualList'; 