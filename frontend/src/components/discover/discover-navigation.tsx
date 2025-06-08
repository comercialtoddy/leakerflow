import { cn } from '@/lib/utils';
import { Category } from '@/types/discover';

interface DiscoverNavigationProps {
  categories: readonly Category[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

export function DiscoverNavigation({ 
  categories, 
  activeCategory, 
  onCategoryChange 
}: DiscoverNavigationProps) {
  return (
    <nav className="py-6" id="discover-categories">
      <div className="flex items-center space-x-6 overflow-x-auto scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              "relative flex items-center space-x-2 px-4 py-3 rounded-lg transition-all duration-200 whitespace-nowrap",
              "hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20",
              activeCategory === category.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-sm">{category.icon}</span>
            <span className="font-medium text-sm">{category.label}</span>
            {/* Active indicator - pill style to match home navbar */}
            {activeCategory === category.id && (
              <div className="absolute inset-0 rounded-lg bg-accent/60 border border-border -z-10" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
} 