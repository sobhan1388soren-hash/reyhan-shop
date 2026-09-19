export function HeroVisual({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 520"
      role="img"
      aria-label="دستگاه تصفیه آب خانگی با جریان آب تصفیه‌شده — ریحان"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="hv-bg" x1="120" y1="40" x2="440" y2="480" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eef8fb" />
          <stop offset="1" stopColor="#d5eef5" />
        </linearGradient>
        <linearGradient id="hv-body" x1="280" y1="78" x2="280" y2="390" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#f2fafc" />
        </linearGradient>
        <linearGradient id="hv-water" x1="280" y1="452" x2="280" y2="508" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7ac1d6" />
          <stop offset="1" stopColor="#0ea5c8" />
        </linearGradient>
      </defs>

      <path
        d="M280 26c104 0 186 64 206 158 20 94-30 202-138 258C240 498 118 468 72 366 26 264 74 130 176 60c34-23 66-34 104-34Z"
        fill="url(#hv-bg)"
      />
      <circle cx="88" cy="118" r="44" stroke="#a8d9e8" strokeWidth="2" opacity=".45" />
      <circle cx="512" cy="128" r="26" stroke="#86efac" strokeWidth="2" opacity=".5" />
      <circle cx="58" cy="328" r="6" fill="#a8d9e8" />
      <path d="M50 184v12M44 190h12" stroke="#a8d9e8" strokeWidth="2" strokeLinecap="round" />
      <path d="M512 382v12M506 388h12" stroke="#a8d9e8" strokeWidth="2" strokeLinecap="round" />

      <ellipse cx="280" cy="402" rx="112" ry="14" fill="#0c6b8a" opacity=".06" />

      <rect x="182" y="78" width="196" height="312" rx="30" fill="url(#hv-body)" stroke="#a8d9e8" strokeWidth="2" />
      <rect x="208" y="102" width="144" height="32" rx="16" fill="#eef8fb" stroke="#d5eef5" strokeWidth="1.5" />
      <circle cx="226" cy="118" r="5" fill="#16a34a" />
      <circle cx="242" cy="118" r="5" fill="#0ea5c8" />
      <rect x="296" y="110" width="44" height="16" rx="8" fill="#ffffff" stroke="#a8d9e8" strokeWidth="1.5" />

      <rect x="200" y="148" width="42" height="204" rx="20" fill="#ffffff" stroke="#d5eef5" strokeWidth="2" />
      <rect x="200" y="148" width="42" height="24" rx="12" fill="#7ac1d6" />
      <path
        d="M208 194h26M208 210h26M208 226h26M208 242h26M208 258h26M208 274h26M208 290h26M208 306h26M208 322h26"
        stroke="#e6f3f7"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <rect x="259" y="148" width="42" height="204" rx="20" fill="#ffffff" stroke="#d5eef5" strokeWidth="2" />
      <rect x="259" y="148" width="42" height="24" rx="12" fill="#86efac" />
      <path
        d="M267 194h26M267 210h26M267 226h26M267 242h26M267 258h26M267 274h26M267 290h26M267 306h26M267 322h26"
        stroke="#e6f3f7"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <rect x="318" y="148" width="42" height="204" rx="20" fill="#ffffff" stroke="#d5eef5" strokeWidth="2" />
      <rect x="318" y="148" width="42" height="24" rx="12" fill="#7ac1d6" />
      <path
        d="M326 194h26M326 210h26M326 226h26M326 242h26M326 258h26M326 274h26M326 290h26M326 306h26M326 322h26"
        stroke="#e6f3f7"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <rect x="206" y="374" width="148" height="12" rx="6" fill="#d5eef5" />
      <rect x="266" y="386" width="28" height="14" rx="5" fill="#a8d9e8" />
      <circle cx="280" cy="412" r="5" fill="#0ea5c8" />
      <circle cx="280" cy="432" r="4" fill="#0ea5c8" opacity=".7" />

      <path d="M234 452h92l-12 56H246l-12-56Z" fill="#ffffff" stroke="#a8d9e8" strokeWidth="2" strokeLinejoin="round" />
      <path d="M241 472h78l-8 30h-62l-8-30Z" fill="url(#hv-water)" />
      <path d="M246 480l5 18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      <path d="M348 466c16-14 36-15 46-6-7 15-27 22-46 6Z" fill="#dcfce7" stroke="#0f8a3d" strokeWidth="1.5" strokeLinejoin="round" />

      <path
        d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z"
        transform="translate(421 86) scale(1.9)"
        fill="#0ea5c8"
      />
      <path
        d="M12 3.2C12 3.2 7.2 8.2 7.2 12.2C7.2 14.9 9.35 17.05 12 17.05C14.65 17.05 16.8 14.9 16.8 12.2C16.8 8.2 12 3.2 12 3.2Z"
        transform="translate(112 214) scale(1.4)"
        fill="#16a34a"
        opacity=".9"
      />

      <circle cx="482" cy="248" r="27" fill="#ffffff" stroke="#dcfce7" strokeWidth="2" />
      <path d="M470 248l8.5 8.5L496 238" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="86" cy="352" r="20" fill="#ffffff" stroke="#d5eef5" strokeWidth="2" />
      <path d="M86 342c4 5.5 6.5 8.7 6.5 11.9a6.5 6.5 0 1 1-13 0c0-3.2 2.5-6.4 6.5-11.9Z" fill="#0ea5c8" />
    </svg>
  );
}
