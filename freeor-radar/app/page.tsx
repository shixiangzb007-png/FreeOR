import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { FreeModel } from '@/types';
import HomeContent from '@/components/dashboard/HomeContent';

export const revalidate = 300; // Revalidate every 5 minutes

async function getModels(): Promise<FreeModel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('free_models')
    .select('*')
    .eq('is_free', true)
    .order('last_updated', { ascending: false })
    .limit(200);
  return (data as FreeModel[]) || [];
}

async function getNewTodayCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('change_logs')
    .select('*', { count: 'exact', head: true })
    .eq('change_type', 'new')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  return count || 0;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const [models, newToday] = await Promise.all([getModels(), getNewTodayCount()]);

  // Get top 5 for recommendation cards (most context)
  const topModels = [...models]
    .sort((a, b) => (b.context || 0) - (a.context || 0))
    .slice(0, 5);

  return (
    <Suspense fallback={<div className="h-64 rounded-xl bg-white/3 animate-pulse" />}>
      <HomeContent 
        models={models} 
        topModels={topModels} 
        newToday={newToday} 
        initialSearch={params.search || ''} 
      />
    </Suspense>
  );
}
