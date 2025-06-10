import { supabase } from './client';
import type { Database } from '@/types/supabase';

export type Category = Database['public']['Tables']['categories']['Row'];
export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export class CategoriesService {
  
  /**
   * Get all active categories ordered by sort_order
   */
  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all categories (including inactive) for management
   */
  async getAllCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching all categories:', error);
      throw new Error(`Failed to fetch all categories: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a new category
   */
  async createCategory(category: Omit<CategoryInsert, 'user_id'>): Promise<Category> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to create categories');
    }

    // Generate slug from name if not provided
    const slug = category.slug || this.generateSlug(category.name);

    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...category,
        slug,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      throw new Error(`Failed to create category: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, updates: CategoryUpdate): Promise<Category> {
    // Generate slug from name if name is being updated and slug not provided
    if (updates.name && !updates.slug) {
      updates.slug = this.generateSlug(updates.name);
    }

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      throw new Error(`Failed to update category: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a category (soft delete by setting is_active to false)
   */
  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }

  /**
   * Hard delete a category (permanently remove)
   */
  async hardDeleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error hard deleting category:', error);
      throw new Error(`Failed to permanently delete category: ${error.message}`);
    }
  }

  /**
   * Reactivate a category
   */
  async reactivateCategory(id: string): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error reactivating category:', error);
      throw new Error(`Failed to reactivate category: ${error.message}`);
    }

    return data;
  }

  /**
   * Update category sort order
   */
  async updateCategoryOrder(categoryIds: string[]): Promise<void> {
    const updates = categoryIds.map((id, index) => ({
      id,
      sort_order: index,
    }));

    for (const update of updates) {
      await this.updateCategory(update.id, { sort_order: update.sort_order });
    }
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<Array<{ category: string; count: number }>> {
    const { data, error } = await supabase
      .from('articles')
      .select('category')
      .eq('status', 'published');

    if (error) {
      console.error('Error fetching category stats:', error);
      return [];
    }

    // Count articles by category
    const stats = data.reduce((acc, article) => {
      const category = article.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(stats).map(([category, count]) => ({
      category,
      count,
    }));
  }
}

export const categoriesService = new CategoriesService(); 