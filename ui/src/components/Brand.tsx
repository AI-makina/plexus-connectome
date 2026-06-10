import React from 'react';

// "The Synapse" — one filled node, one open node, one arc between them (DESIGN_SPEC §8.3).
// currentColor so it inherits text-hi in chrome and ink-1 on light surfaces.
export function LogoMark({ size = 16, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden="true"
        >
            <circle cx="3.5" cy="12.5" r="2.1" fill="currentColor" />
            <circle cx="12.5" cy="3.5" r="2.1" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 11 Q 9 9.5 11 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}
