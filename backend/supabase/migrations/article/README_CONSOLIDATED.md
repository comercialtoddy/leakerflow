# Articles System - Consolidated Migrations

## Overview

This directory contains the **CONSOLIDATED** articles system migrations that replace the original 18 fragmented migration files with 9 organized, maintainable files. All fixes have been automatically applied during consolidation.

## Migration Structure

### 📁 **New Consolidated Structure (9 Files)**

```
01_articles_foundation.sql          → Core tables + indexes + storage + triggers
02_articles_voting_analytics.sql    → Voting system + events + analytics 
03_articles_realtime_activity.sql   → Real-time user activity tracking
04_articles_basejump_integration.sql → Multi-tenant integration + data migration
05_articles_user_interactions.sql   → User saves + public access + functions
06_articles_advanced_functions.sql  → Dashboard + analytics + time series
07_articles_permissions_grants.sql  → All permission grants centralized
08_articles_policies_security.sql   → All RLS policies + security
09_articles_setup_initialization.sql → Real-time setup + sample data
```

### 🗂️ **Original Structure (18 Files) - DEPRECATED**

```
❌ 01_articles_core_tables.sql         → Consolidated into 01_
❌ 02_articles_voting_system.sql       → Consolidated into 02_
❌ 03_articles_analytics_system.sql    → Consolidated into 02_
❌ 04_articles_analytics_advanced.sql  → Consolidated into 06_
❌ 05_articles_realtime_activity.sql   → Consolidated into 03_
❌ 06_articles_storage.sql             → Consolidated into 01_
❌ 07_articles_public_functions.sql    → Consolidated into 05_
❌ 08_articles_permissions.sql         → Consolidated into 07_
❌ 09_articles_initial_setup.sql       → Consolidated into 09_
❌ 10-13_articles_basejump_*.sql       → Consolidated into 04_
❌ 14_fix_user_specific_saves.sql      → ✅ APPLIED AUTOMATICALLY
❌ 15_fix_public_article_interactions.sql → ✅ APPLIED AUTOMATICALLY
❌ 16_fix_vote_function_account_id.sql → ✅ APPLIED AUTOMATICALLY
❌ 17_fix_duplicate_save_events.sql    → ✅ APPLIED AUTOMATICALLY
❌ 99_articles_basejump_rollback.sql   → Emergency rollback (kept)
```

## ✅ Applied Fixes Summary

All critical fixes have been automatically integrated:

### **Fix 1: User-Specific Saves**
- ✅ Created `saved_articles` junction table
- ✅ Replaced global `saved` field with user-specific saves
- ✅ Updated all functions to use user-specific logic
- ✅ Added automatic `total_saves` calculation triggers

### **Fix 2: Public Article Access**
- ✅ Enhanced RLS policies for public article interactions
- ✅ Allowed authenticated users to vote/save any public article
- ✅ Fixed overly restrictive access policies
- ✅ Maintained security while enabling discoverability

### **Fix 3: Voting with Account ID**
- ✅ Updated `vote_on_article()` function to work with Basejump
- ✅ Fixed `track_article_event()` to include account_id
- ✅ Ensured all voting operations respect multi-tenancy
- ✅ Maintained vote tracking across account boundaries

### **Fix 4: Duplicate Event Prevention**
- ✅ Added logic to prevent duplicate `view` and `save` events
- ✅ Updated `track_article_event()` with duplicate detection
- ✅ Clean removal of duplicate events when unsaving
- ✅ Ensured data integrity across all interactions

## 🚀 Migration Instructions

### **Step 1: Run Consolidated Migrations**

**Option A: Use the Fixed Migration Script (Recommended)**
```sql
\i backend/supabase/migrations/article/MIGRATION_SCRIPT_FIXED.sql
```

**Option B: Execute files individually**
```sql
-- Run each file in sequence
\i 01_articles_foundation.sql
\i 02_articles_voting_analytics.sql
\i 03_articles_realtime_activity.sql
\i 04_articles_basejump_integration.sql
\i 05_articles_user_interactions.sql
\i 06_articles_advanced_functions.sql
\i 07_articles_permissions_grants.sql
\i 08_articles_policies_security.sql
\i 09_articles_setup_initialization.sql
```

### **Step 2: Verify System Health**

```sql
-- Check system completeness
SELECT articles_system_health_check();

-- Verify all components are working
SELECT setup_article_cron_jobs();
```

### **Step 3: Set Up Cron Jobs (Recommended)**

```sql
-- Execute the recommended cron jobs
SELECT cron.schedule('cleanup-old-articles', '0 2 * * *', 'SELECT cleanup_old_articles();');
SELECT cron.schedule('aggregate-article-analytics', '0 1 * * *', 'SELECT aggregate_daily_analytics();');
SELECT cron.schedule('calculate-trending-articles', '0 * * * *', 'SELECT calculate_trend_scores();');
SELECT cron.schedule('cleanup-realtime-activities', '*/30 * * * *', 'SELECT cleanup_old_activities();');
SELECT cron.schedule('refresh-analytics-cache', '0 3 * * 0', 'SELECT refresh_analytics_cache();');
```

## 🏗️ System Architecture

### **Core Components**

1. **📊 Tables**: 6 main tables with proper relationships
2. **⚡ Functions**: 30+ specialized functions for all operations
3. **🔒 Policies**: 20+ RLS policies for security
4. **📈 Indexes**: 25+ optimized indexes for performance
5. **🔄 Triggers**: Auto-updating triggers for data integrity
6. **📡 Real-time**: Live subscriptions for all major events

### **Key Features**

- ✅ **Multi-tenant**: Full Basejump integration with account-based access
- ✅ **Real-time**: Live updates for votes, saves, activity
- ✅ **Analytics**: Comprehensive dashboard and reporting
- ✅ **Security**: Robust RLS policies for all access patterns
- ✅ **Performance**: Optimized indexes and caching
- ✅ **User Experience**: Seamless saves, votes, and interactions

## 📋 Testing Checklist

After migration, verify these features work:

- [ ] **Article Creation**: Create articles in personal/team accounts
- [ ] **Public Access**: View public articles without authentication
- [ ] **Voting System**: Upvote/downvote articles with real-time updates
- [ ] **Save Articles**: Save/unsave articles (user-specific)
- [ ] **Analytics**: View dashboard stats and time series
- [ ] **Real-time**: See live activity indicators
- [ ] **Multi-tenant**: Switch between accounts and see proper data
- [ ] **Permissions**: Verify access control works correctly

## 🔧 Maintenance

### **Health Monitoring**

```sql
-- Regular health check
SELECT articles_system_health_check();

-- Check for orphaned data
SELECT COUNT(*) FROM articles WHERE account_id IS NULL;
SELECT COUNT(*) FROM article_events WHERE account_id IS NULL;
```

### **Performance Monitoring**

```sql
-- Check analytics performance
SELECT * FROM get_enhanced_dashboard_stats(30);

-- Monitor trending articles
SELECT * FROM get_trending_articles(10);
```

### **Data Cleanup**

The system includes automatic cleanup jobs, but you can run them manually:

```sql
-- Manual cleanup
SELECT cleanup_old_articles();
SELECT cleanup_old_activities();
SELECT recalculate_article_saves();
```

## 🆘 Troubleshooting

### **Common Issues**

1. **Permission Error on storage.objects**: 
   - **Solution**: Use `MIGRATION_SCRIPT_FIXED.sql` instead of the original script
   - **Cause**: Trying to modify storage.objects requires superuser privileges
   - **Fix Applied**: Removed unnecessary storage.objects RLS modification

2. **Missing account_id**: Run the Basejump integration migration again

3. **Permission denied on functions**: 
   - Ensure you have CREATE privileges on the database
   - Some functions use SECURITY DEFINER which is normal

4. **Duplicate events**: The system now prevents these automatically

5. **Missing functions**: Ensure all 9 files were executed in order

### **Debug Tools**

```sql
-- Test article access
SELECT test_article_access('article-uuid-here');

-- Check user accounts
SELECT * FROM get_user_article_accounts();

-- Verify real-time subscriptions
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

## 📝 Notes

- **Backward Compatibility**: All existing API endpoints continue to work
- **Data Integrity**: All existing data is preserved and migrated
- **Performance**: Significantly improved due to better structure
- **Maintainability**: Much easier to understand and modify
- **Security**: Enhanced with proper multi-tenant policies
- **Permission Fix**: Storage.objects permission issue resolved in fixed migration script

## 🔄 Updates

### **v1.1 - Permission Fix**
- ✅ **Fixed**: Removed `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` 
- ✅ **Added**: `MIGRATION_SCRIPT_FIXED.sql` with proper error handling
- ✅ **Improved**: Better troubleshooting documentation
- **Reason**: Supabase already enables RLS on storage.objects by default

---

**🎉 The consolidated system is production-ready and includes all necessary fixes!** 