import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { FreeModel } from '@/types';
import { ModelTableClient } from '@/components/dashboard/ModelTableClient';
import { HeroCard } from '@/components/dashboard/HeroCard';
import { TopModelCards } from '@/components/dashboard/TopModelCards';
import { CreditBanner } from '@/components/dashboard/CreditBanner';

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
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Hero section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <HeroCard total={models.length} newToday={newToday} />
        </div>
        <div className="lg:col-span-2">
          <CreditBanner />
        </div>
      </div>

      {/* Top 5 Recommended */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-white/80">⭐ Top 5 推荐模型</h2>
          <span className="text-xs text-white/30">按上下文长度排序</span>
        </div>
        <TopModelCards models={topModels} />
      </section>

      {/* Full model table */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-white/80">📋 全部免费模型</h2>
          <span className="badge-free">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {models.length} 个
          </span>
        </div>
        <Suspense fallback={<div className="h-64 rounded-xl bg-white/3 animate-pulse" />}>
          <ModelTableClient
            models={models}
            initialSearch={params.search || ''}
          />
        </Suspense>
      </section>
    </div>
  );
}
