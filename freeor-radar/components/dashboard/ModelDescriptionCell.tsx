'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModelDescriptionCellProps {
    text: string | null | undefined;
    emptyLabel: string;
}

const TOOLTIP_MAX_W = 360;
const TOOLTIP_MAX_H = 224;
const VIEWPORT_PAD = 12;

export function ModelDescriptionCell({ text, emptyLabel }: ModelDescriptionCellProps) {
    const trimmed = text?.trim();
    const anchorRef = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0, above: false });

    const clearHideTimer = useCallback(() => {
        if (hideTimer.current) {
            clearTimeout(hideTimer.current);
            hideTimer.current = null;
        }
    }, []);

    const updatePosition = useCallback(() => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (!rect) return;

        let x = rect.left;
        if (x + TOOLTIP_MAX_W > window.innerWidth - VIEWPORT_PAD) {
            x = Math.max(VIEWPORT_PAD, window.innerWidth - TOOLTIP_MAX_W - VIEWPORT_PAD);
        }

        const spaceBelow = window.innerHeight - rect.bottom;
        const above = spaceBelow < TOOLTIP_MAX_H + 24;
        const y = above ? rect.top - 8 : rect.bottom + 8;
        setCoords({ x, y, above });
    }, []);

    const showTooltip = useCallback(() => {
        clearHideTimer();
        updatePosition();
        setOpen(true);
    }, [clearHideTimer, updatePosition]);

    const hideTooltip = useCallback(() => {
        clearHideTimer();
        hideTimer.current = setTimeout(() => setOpen(false), 150);
    }, [clearHideTimer]);

    useEffect(() => {
        if (!open) return;
        const onScrollOrResize = () => updatePosition();
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [open, updatePosition]);

    useEffect(() => () => clearHideTimer(), [clearHideTimer]);

    if (!trimmed) {
        return <span className="text-xs text-white/25">{emptyLabel}</span>;
    }

    return (
        <>
            <div
                ref={anchorRef}
                className="cursor-help"
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                tabIndex={0}
                aria-describedby={open ? 'model-desc-tooltip' : undefined}
            >
                <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{trimmed}</p>
            </div>
            {open &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        id="model-desc-tooltip"
                        role="tooltip"
                        className="fixed z-[9999] rounded-lg border border-white/15 bg-neutral-950/98 px-3 py-2.5 text-xs leading-relaxed text-white/90 shadow-2xl backdrop-blur-sm"
                        style={{
                            left: coords.x,
                            top: coords.y,
                            maxWidth: TOOLTIP_MAX_W,
                            maxHeight: TOOLTIP_MAX_H,
                            transform: coords.above ? 'translateY(-100%)' : undefined,
                            overflowY: 'auto',
                        }}
                        onMouseEnter={showTooltip}
                        onMouseLeave={hideTooltip}
                    >
                        {trimmed}
                    </div>,
                    document.body
                )}
        </>
    );
}
