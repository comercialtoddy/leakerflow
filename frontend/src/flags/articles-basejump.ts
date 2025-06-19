import { useFlags } from '@/hooks/use-feature-flags';

// Feature flag keys for articles Basejump integration
export const ARTICLES_BASEJUMP_FLAGS = {
  // Phase 1: Read-only - shows new UI but still uses old backend
  SHOW_ACCOUNT_SELECTOR: 'articles_show_account_selector',
  
  // Phase 2: Opt-in - users can choose to use new system
  ENABLE_TEAM_ARTICLES: 'articles_enable_team_articles',
  
  // Phase 3: Default on - new system is default
  USE_BASEJUMP_BY_DEFAULT: 'articles_use_basejump_default',
  
  // Phase 4: Mandatory - removes old code completely
  FORCE_BASEJUMP: 'articles_force_basejump'
} as const;

export type ArticlesBasejumpFlag = typeof ARTICLES_BASEJUMP_FLAGS[keyof typeof ARTICLES_BASEJUMP_FLAGS];

interface ArticlesFeatureFlags {
  showAccountSelector: boolean;
  enableTeamArticles: boolean;
  useBasejumpByDefault: boolean;
  forceBasejump: boolean;
  isLoading: boolean;
}

/**
 * Hook to get articles feature flags for Basejump integration
 */
export function useArticlesFeatureFlags(): ArticlesFeatureFlags {
  const { data: flags, isLoading } = useFlags([
    ARTICLES_BASEJUMP_FLAGS.SHOW_ACCOUNT_SELECTOR,
    ARTICLES_BASEJUMP_FLAGS.ENABLE_TEAM_ARTICLES,
    ARTICLES_BASEJUMP_FLAGS.USE_BASEJUMP_BY_DEFAULT,
    ARTICLES_BASEJUMP_FLAGS.FORCE_BASEJUMP
  ]);
  
  return {
    showAccountSelector: flags?.articles_show_account_selector ?? false,
    enableTeamArticles: flags?.articles_enable_team_articles ?? false,
    useBasejumpByDefault: flags?.articles_use_basejump_default ?? false,
    forceBasejump: flags?.articles_force_basejump ?? false,
    isLoading
  };
}

/**
 * Determine which article service/hooks to use based on feature flags
 */
export function shouldUseBasejumpArticles(flags: ArticlesFeatureFlags): boolean {
  // If force flag is on, always use new system
  if (flags.forceBasejump) return true;
  
  // If team articles are enabled, use new system
  if (flags.enableTeamArticles) return true;
  
  // If new system is default, use it
  if (flags.useBasejumpByDefault) return true;
  
  // Otherwise, use old system
  return false;
} 