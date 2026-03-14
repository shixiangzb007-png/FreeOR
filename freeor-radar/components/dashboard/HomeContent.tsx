'use client';

import { Suspense } from 'react';
import { FreeModel } from '@/types';
import { ModelTableClient } from '@/components/dashboard/ModelTableClient';
import { HeroCard } from '@/components/dashboard/HeroCard';
import { TopModelCards } from '@/components/dashboard/TopModelCards';
import { CreditBanner } from '@/components/dashboard/CreditBanner';
import { useLang } from '@/lib/i18n/lang-context';

interface HomeContentProps {
  models: FreeModel[];
  topModels: FreeModel[];
  newToday: number;
  initialSearch: string;
}

export default function HomeContent({ models, topModels, newToday, initialSearch }: HomeContentProps) {
  const { t } = useLang();

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
          <h2 className="text-base font-semibold text-white/80">{t('home.top5.title')}</h2>
          <span className="text-xs text-white/30">{t('home.top5.subtitle')}</span>
        </div>
        <TopModelCards models={topModels} />
      </section>

      {/* Full model table */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-white/80">{t('home.table.title')}</h2>
          <span className="badge-free">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {models.length} {t('home.table.count')}
          </span>
        </div>
        <Suspense fallback={<div className="h-64 rounded-xl bg-white/3 animate-pulse" />}>
          <ModelTableClient
            models={models}
            initialSearch={initialSearch}
          />
        </Suspense>
      </section>
    </div>
  );
}
