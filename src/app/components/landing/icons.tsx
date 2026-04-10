export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="14"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line
        x1="10"
        y1="4"
        x2="10"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.25 7.5L9 2.25L15.75 7.5V15C15.75 15.3978 15.592 15.7794 15.3107 16.0607C15.0294 16.342 14.6478 16.5 14.25 16.5H3.75C3.35218 16.5 2.97064 16.342 2.68934 16.0607C2.40804 15.7794 2.25 15.3978 2.25 15V7.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M6.75 16.5V9H11.25V16.5" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
    </svg>
  )
}

export function IconTrainLora({ className }: { className?: string }) {
  return (
    <span className={`inline-flex h-[18px] w-[18px] shrink-0 rounded-full ${className ?? ""}`} aria-hidden>
      <span
        className="h-full w-full rounded-full"
        style={{
          background:
            "conic-gradient(from 180deg, #f472b6, #a78bfa, #38bdf8, #4ade80, #facc15, #fb923c, #f472b6)",
        }}
      />
    </span>
  )
}

export function IconNodeEditor({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2" y="2" width="14" height="14" rx="2" fill="#2563EB" />
      <path d="M6 6H12M6 9H12M6 12H9" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconFolder({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.25 5.25C2.25 4.42157 2.92157 3.75 3.75 3.75H6.96447C7.25521 3.75 7.53446 3.86552 7.73744 4.06849L8.68155 5.0126C8.88452 5.21557 9.16377 5.33109 9.45451 5.33109H14.25C15.0784 5.33109 15.75 6.00266 15.75 6.83109V13.5C15.75 14.3284 15.0784 15 14.25 15H3.75C2.92157 15 2.25 14.3284 2.25 13.5V5.25Z"
        fill="#3B82F6"
      />
    </svg>
  )
}

export function IconImage({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2" y="4" width="14" height="10" rx="1.5" stroke="#3B82F6" strokeWidth="1.35" />
      <circle cx="6" cy="8" r="1.25" fill="#3B82F6" />
      <path d="M2 13L5.5 9.5L8 12L11 9L16 13.5" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconVideo({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2" y="4.5" width="10" height="9" rx="1.5" stroke="#F97316" strokeWidth="1.35" />
      <path d="M12.5 7L16 5V13L12.5 11V7Z" fill="#F97316" />
    </svg>
  )
}

export function IconWand({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M3.5 14.5L12 6M12 6L10.5 4.5M12 6L13.5 7.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 13L5 14L3.5 15.5L2.5 14.5L4 13Z" fill="currentColor" />
      <circle cx="14" cy="4" r="1" fill="currentColor" />
      <circle cx="11.5" cy="3" r="0.75" fill="currentColor" />
      <circle cx="15.5" cy="6.5" r="0.75" fill="currentColor" />
    </svg>
  )
}

export function IconBanana({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M4 12C4 12 5.5 6 10 4.5C12 4 14 4.5 14.5 6C15 7.5 13.5 9 11.5 10C8 12 5.5 12.5 4 12Z"
        stroke="#EAB308"
        strokeWidth="1.35"
        strokeLinecap="round"
        fill="#FACC15"
        fillOpacity="0.35"
      />
    </svg>
  )
}

export function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M10 2L4 10H9L8 16L14 8H9L10 2Z" fill="#3B82F6" />
    </svg>
  )
}

export function IconBrush({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M3 14C3 14 4.5 12.5 6.5 12.5C8.5 12.5 10 14 10 14"
        stroke="#A855F7"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path d="M10 14L15 9L12 6L7 11V14H10Z" fill="#A855F7" fillOpacity="0.9" />
      <path d="M12 6L14 4L15 5L13 7L12 6Z" fill="#C084FC" />
    </svg>
  )
}

export function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconLipsync({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect width="18" height="18" rx="4" fill="#18181B" />
      <path d="M9 4.5V9.5M9 9.5L7.5 8M9 9.5L10.5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 10.5C6.5 11.5 7.5 12.5 9 12.5C10.5 12.5 11.5 11.5 11.5 10.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 12.5V14.5M6.5 14.5H11.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconMotion({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect width="18" height="18" rx="4" fill="#BEF264" />
      <path d="M9 5C9.55228 5 10 4.55228 10 4C10 3.44772 9.55228 3 9 3C8.44772 3 8 3.44772 8 4C8 4.55228 8.44772 5 9 5Z" fill="#18181B" />
      <path d="M9 6V11.5M9 11.5L7 15M9 11.5L11 15M6 8H12" stroke="#18181B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Icon3D({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect width="18" height="18" rx="4" fill="#27272A" />
      <path d="M9 4.5L13.5 7V11L9 13.5L4.5 11V7L9 4.5Z" stroke="white" strokeWidth="1.2" strokeLinejoin="round" opacity="0.6" />
      <path d="M4.5 7L9 9.5L13.5 7M9 9.5V13.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconRestyle({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect width="18" height="18" rx="4" fill="#FDBA74" />
      <rect x="5" y="4" width="8" height="10" rx="1" stroke="#18181B" strokeWidth="1.2" />
      <path d="M5 6H13M5 9H13M5 12H13" stroke="#18181B" strokeWidth="0.8" />
      <circle cx="6.5" cy="5" r="0.4" fill="#18181B" />
      <circle cx="11.5" cy="5" r="0.4" fill="#18181B" />
      <circle cx="6.5" cy="13" r="0.4" fill="#18181B" />
      <circle cx="11.5" cy="13" r="0.4" fill="#18181B" />
    </svg>
  )
}
