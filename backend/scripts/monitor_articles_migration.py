#!/usr/bin/env python3
"""
Monitor Articles Basejump Migration Progress

This script provides real-time monitoring of the articles migration to Basejump.
Run it periodically to track progress and identify issues.
"""

import asyncio
import os
from datetime import datetime
from typing import Dict, Any, List
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.layout import Layout
from rich.live import Live
from rich.progress import Progress, SpinnerColumn, TextColumn
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.supabase import create_supabase_admin_client

load_dotenv()

console = Console()


class ArticlesMigrationMonitor:
    def __init__(self):
        self.supabase = None
        
    async def initialize(self):
        """Initialize Supabase connection"""
        self.supabase = await create_supabase_admin_client()
        
    async def get_migration_stats(self) -> Dict[str, Any]:
        """Get overall migration statistics"""
        try:
            # Total articles
            total_result = await self.supabase.table('articles').select('id', count='exact').execute()
            total_articles = total_result.count or 0
            
            # Articles with account_id
            migrated_result = await self.supabase.table('articles').select('id', count='exact').not_.is_('account_id', 'null').execute()
            migrated_articles = migrated_result.count or 0
            
            # Articles without account_id
            unmigrated_articles = total_articles - migrated_articles
            
            # Articles by visibility
            visibility_stats = {}
            for visibility in ['public', 'account', 'private']:
                result = await self.supabase.table('articles').select('id', count='exact').eq('visibility', visibility).execute()
                visibility_stats[visibility] = result.count or 0
            
            # Personal vs Team articles
            personal_result = await self.supabase.table('articles').select(
                'articles.id',
                count='exact'
            ).inner_join(
                'accounts',
                'articles.account_id',
                'accounts.id'
            ).eq('accounts.personal_account', True).execute()
            personal_articles = personal_result.count or 0
            
            team_articles = migrated_articles - personal_articles
            
            return {
                'total_articles': total_articles,
                'migrated_articles': migrated_articles,
                'unmigrated_articles': unmigrated_articles,
                'migration_percentage': (migrated_articles / total_articles * 100) if total_articles > 0 else 0,
                'visibility_stats': visibility_stats,
                'personal_articles': personal_articles,
                'team_articles': team_articles,
            }
        except Exception as e:
            console.print(f"[red]Error getting migration stats: {e}[/red]")
            return {}
    
    async def get_problem_users(self) -> List[Dict[str, Any]]:
        """Get users with articles but no account"""
        try:
            # Query for users with articles but no primary account
            query = """
            SELECT DISTINCT 
                u.id,
                u.email,
                COUNT(a.id) as article_count
            FROM auth.users u
            INNER JOIN articles a ON a.user_id = u.id
            LEFT JOIN account_user au ON au.user_id = u.id AND au.is_primary = true
            WHERE au.account_id IS NULL
            GROUP BY u.id, u.email
            """
            
            result = await self.supabase.rpc('execute_sql', {'query': query}).execute()
            return result.data or []
        except Exception as e:
            console.print(f"[yellow]Could not get problem users: {e}[/yellow]")
            return []
    
    async def get_recent_activity(self) -> Dict[str, Any]:
        """Get recent article activity"""
        try:
            # Articles created in last 24 hours
            recent_created = await self.supabase.table('articles').select(
                'id', count='exact'
            ).gte('created_at', 'now() - interval \'24 hours\'').execute()
            
            # Articles with account_id created in last 24 hours
            recent_migrated = await self.supabase.table('articles').select(
                'id', count='exact'
            ).gte('created_at', 'now() - interval \'24 hours\'').not_.is_('account_id', 'null').execute()
            
            return {
                'recent_created': recent_created.count or 0,
                'recent_migrated': recent_migrated.count or 0,
            }
        except Exception as e:
            console.print(f"[yellow]Could not get recent activity: {e}[/yellow]")
            return {'recent_created': 0, 'recent_migrated': 0}
    
    async def check_rls_policies(self) -> Dict[str, bool]:
        """Check if new RLS policies are in place"""
        try:
            # Check for new policies
            policies_result = await self.supabase.rpc('get_policies', {
                'table_name': 'articles'
            }).execute()
            
            policies = {p['policyname'] for p in (policies_result.data or [])}
            
            expected_policies = {
                'articles_select_policy',
                'articles_insert_policy',
                'articles_update_policy',
                'articles_delete_policy'
            }
            
            return {
                policy: policy in policies 
                for policy in expected_policies
            }
        except Exception as e:
            console.print(f"[yellow]Could not check RLS policies: {e}[/yellow]")
            return {}
    
    def create_dashboard(self, stats: Dict[str, Any], problems: List[Dict[str, Any]], 
                        activity: Dict[str, Any], policies: Dict[str, bool]) -> Layout:
        """Create a rich dashboard layout"""
        layout = Layout()
        
        # Header
        header = Panel(
            f"[bold cyan]Articles Basejump Migration Monitor[/bold cyan]\n"
            f"[dim]{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/dim]",
            style="bold white on blue"
        )
        
        # Migration Stats Table
        stats_table = Table(title="Migration Progress", show_header=True, header_style="bold magenta")
        stats_table.add_column("Metric", style="cyan", no_wrap=True)
        stats_table.add_column("Value", justify="right")
        stats_table.add_column("Status", justify="center")
        
        migration_pct = stats.get('migration_percentage', 0)
        status_color = "green" if migration_pct == 100 else "yellow" if migration_pct > 50 else "red"
        
        stats_table.add_row("Total Articles", str(stats.get('total_articles', 0)), "")
        stats_table.add_row("Migrated", str(stats.get('migrated_articles', 0)), f"[{status_color}]{'✓' if migration_pct == 100 else '⚠'}[/{status_color}]")
        stats_table.add_row("Unmigrated", str(stats.get('unmigrated_articles', 0)), f"[red]{'✗' if stats.get('unmigrated_articles', 0) > 0 else ''}[/red]")
        stats_table.add_row("Progress", f"{migration_pct:.1f}%", f"[{status_color}]{'█' * int(migration_pct / 10)}{'░' * (10 - int(migration_pct / 10))}[/{status_color}]")
        
        # Visibility Stats
        vis_table = Table(title="Visibility Distribution", show_header=True, header_style="bold magenta")
        vis_table.add_column("Type", style="cyan")
        vis_table.add_column("Count", justify="right")
        
        for vis_type, count in stats.get('visibility_stats', {}).items():
            vis_table.add_row(vis_type.capitalize(), str(count))
        
        # Account Type Stats
        account_table = Table(title="Account Types", show_header=True, header_style="bold magenta")
        account_table.add_column("Type", style="cyan")
        account_table.add_column("Count", justify="right")
        
        account_table.add_row("Personal", str(stats.get('personal_articles', 0)))
        account_table.add_row("Team", str(stats.get('team_articles', 0)))
        
        # Recent Activity
        activity_panel = Panel(
            f"[cyan]Last 24 Hours:[/cyan]\n"
            f"Articles Created: [yellow]{activity.get('recent_created', 0)}[/yellow]\n"
            f"With Account ID: [green]{activity.get('recent_migrated', 0)}[/green]",
            title="Recent Activity",
            border_style="blue"
        )
        
        # RLS Policies Status
        policies_text = ""
        for policy, exists in policies.items():
            status = "[green]✓[/green]" if exists else "[red]✗[/red]"
            policies_text += f"{status} {policy}\n"
        
        policies_panel = Panel(
            policies_text.strip() or "[yellow]Could not check policies[/yellow]",
            title="RLS Policies",
            border_style="blue"
        )
        
        # Problem Users
        if problems:
            problems_text = "[red]Users without accounts:[/red]\n"
            for user in problems[:5]:  # Show max 5
                problems_text += f"• {user.get('email', 'Unknown')} ({user.get('article_count', 0)} articles)\n"
            if len(problems) > 5:
                problems_text += f"[dim]... and {len(problems) - 5} more[/dim]"
        else:
            problems_text = "[green]No problem users found![/green]"
        
        problems_panel = Panel(problems_text, title="Issues", border_style="red" if problems else "green")
        
        # Layout assembly
        layout.split_column(
            Layout(header, size=3),
            Layout().split_row(
                Layout().split_column(
                    Layout(stats_table),
                    Layout(activity_panel)
                ),
                Layout().split_column(
                    Layout().split_row(
                        Layout(vis_table),
                        Layout(account_table)
                    ),
                    Layout(policies_panel)
                )
            ),
            Layout(problems_panel, size=8)
        )
        
        return layout
    
    async def run_monitor(self, refresh_interval: int = 30):
        """Run the monitor with auto-refresh"""
        await self.initialize()
        
        with Live(Panel("Loading..."), refresh_per_second=1) as live:
            while True:
                try:
                    # Gather all data
                    stats = await self.get_migration_stats()
                    problems = await self.get_problem_users()
                    activity = await self.get_recent_activity()
                    policies = await self.check_rls_policies()
                    
                    # Create and update dashboard
                    dashboard = self.create_dashboard(stats, problems, activity, policies)
                    live.update(dashboard)
                    
                    # Wait for refresh
                    await asyncio.sleep(refresh_interval)
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    console.print(f"[red]Error updating dashboard: {e}[/red]")
                    await asyncio.sleep(5)


async def main():
    monitor = ArticlesMigrationMonitor()
    
    console.print("[bold cyan]Starting Articles Basejump Migration Monitor[/bold cyan]")
    console.print("[dim]Press Ctrl+C to exit[/dim]\n")
    
    try:
        await monitor.run_monitor(refresh_interval=30)
    except KeyboardInterrupt:
        console.print("\n[yellow]Monitor stopped[/yellow]")


if __name__ == "__main__":
    asyncio.run(main()) 