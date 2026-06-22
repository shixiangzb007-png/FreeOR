'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { LegalDoc } from '@/lib/legal/content';
import { useLang } from '@/lib/i18n/lang-context';

interface LegalModalProps {
    doc: LegalDoc | null;
    onClose: () => void;
}

export function LegalModal({ doc, onClose }: LegalModalProps) {
    const { t } = useLang();

    useEffect(() => {
        if (!doc) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [doc, onClose]);

    if (!doc) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-modal-title"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                aria-label={t('legal.close')}
                onClick={onClose}
            />
            <div
                className="relative w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#141414] shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/8 shrink-0">
                    <div>
                        <h2 id="legal-modal-title" className="text-base font-semibold text-white">
                            {doc.title}
                        </h2>
                        <p className="text-[11px] text-white/35 mt-0.5">
                            {t('legal.updated').replace('{date}', doc.updated)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                        aria-label={t('legal.close')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {doc.sections.map(section => (
                        <section key={section.title}>
                            <h3 className="text-sm font-medium text-white/90 mb-2">{section.title}</h3>
                            <div className="space-y-2">
                                {section.body.map((para, i) => (
                                    <p key={i} className="text-xs text-white/50 leading-relaxed">
                                        {para}
                                    </p>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
