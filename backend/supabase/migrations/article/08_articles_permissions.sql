-- Articles Permissions
-- This migration consolidates all permission grants for the articles system

-- =======================
-- SCHEMA PERMISSIONS
-- =======================

-- Grant necessary schema permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- =======================
-- TABLE PERMISSIONS
-- =======================

-- Articles table permissions
GRANT ALL ON articles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO authenticated;
GRANT SELECT ON articles TO anon;

-- Voting table permissions
GRANT ALL ON article_votes TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON article_votes TO authenticated;

-- Events table permissions
GRANT ALL ON article_events TO postgres, service_role;
GRANT SELECT, INSERT ON article_events TO authenticated, anon;

-- Analytics table permissions
GRANT ALL ON article_analytics TO postgres, service_role;
GRANT SELECT ON article_analytics TO authenticated, anon;

-- Realtime activity table permissions
GRANT ALL ON article_realtime_activity TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON article_realtime_activity TO authenticated;

-- =======================
-- FUNCTION PERMISSIONS
-- =======================

-- Core function permissions
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated, anon;

-- Voting function permissions
GRANT EXECUTE ON FUNCTION vote_on_article(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_vote(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_trend_scores() TO authenticated, service_role;

-- Analytics function permissions
GRANT EXECUTE ON FUNCTION track_article_event(uuid, text, integer, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION update_article_metrics(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_article_analytics_summary(uuid, date, date) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION aggregate_daily_analytics(date) TO service_role;

-- Advanced analytics function permissions
GRANT EXECUTE ON FUNCTION get_enhanced_dashboard_stats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_time_series(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_performing_articles(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_reader_behavior_insights(uuid) TO authenticated;

-- Realtime activity function permissions
GRANT EXECUTE ON FUNCTION track_realtime_activity(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION end_realtime_activity(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_article_active_users(uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_global_active_users(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_old_activities() TO service_role;

-- Public function permissions
GRANT EXECUTE ON FUNCTION get_articles_paginated(integer, integer, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION toggle_article_save(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_article_bookmark(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_article_views(uuid, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_articles() TO service_role;

-- Storage cleanup function permissions
GRANT EXECUTE ON FUNCTION cleanup_article_storage() TO service_role; 