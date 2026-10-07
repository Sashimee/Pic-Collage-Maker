/**
 * The app mark — the same photo-stack as public/favicon.svg, simplified for
 * header sizes (no soft-shadow plates, which vanish below ~32px anyway).
 * Keep it in step with favicon.svg and scripts/generate-icons.mjs.
 */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="brand-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset=".55" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <clipPath id="brand-shot">
          <rect x="187" y="173" width="198" height="198" rx="16" />
        </clipPath>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#brand-tile)" />
      <g transform="rotate(-12 222 246)">
        <rect x="117" y="141" width="210" height="210" rx="26" fill="#fff" opacity=".5" />
      </g>
      <g transform="rotate(9 286 272)">
        <rect x="167" y="153" width="238" height="238" rx="30" fill="#fff" />
        <g clipPath="url(#brand-shot)">
          <rect x="187" y="173" width="198" height="198" fill="#eef2ff" />
          <circle cx="240" cy="228" r="25" fill="#fbbf24" />
          <path d="M187 371 V330 L245 262 L282 300 L312 258 L385 330 V371 Z" fill="#6ee7b7" />
          <path d="M187 371 V352 L268 300 L385 352 V371 Z" fill="#10b981" />
        </g>
      </g>
    </svg>
  )
}
