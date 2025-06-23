import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminProvider } from '@/contexts/AdminContext';
import { AdminAnalyticsPanel } from '@/components/admin/AdminAnalyticsPanel';

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is global admin
  const { data: isGlobalAdmin, error } = await supabase.rpc('is_global_admin', {
    user_id: user.id,
  });

  if (error || !isGlobalAdmin) {
    redirect('/dashboard');
  }

  return (
    <AdminProvider>
      <div className="container mx-auto px-4 py-8">
        <AdminAnalyticsPanel />
      </div>
    </AdminProvider>
  );
} 