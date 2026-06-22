'use client';

import { useState } from 'react';
import { LegalModal } from '@/components/layout/LegalModal';
import { getPrivacyDoc, getTermsDoc } from '@/lib/legal/content';
import { useLang } from '@/lib/i18n/lang-context';

type LegalView = 'privacy' | 'terms' | null;

export function MobileFooter() {
    const { t, lang } = useLang();
    const [view, setView] = useState<LegalView>(null);

    const doc =
        view === 'privacy' ? getPrivacyDoc(lang) :
        view === 'terms' ? getTermsDoc(lang) :
        null;

    return (
        <>
            <footer className="mobile-footer lg:hidden">
                <button
                    type="button"
                    onClick={() => setView('privacy')}
                    className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
                >
                    {t('legal.privacy')}
                </button>
                <span className="text-white/20 text-[11px]">·</span>
                <button
                    type="button"
                    onClick={() => setView('terms')}
                    className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
                >
                    {t('legal.terms')}
                </button>
            </footer>
            <LegalModal doc={doc} onClose={() => setView(null)} />
        </>
    );
}
