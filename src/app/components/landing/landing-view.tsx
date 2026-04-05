import { LandingSidebar } from "./sidebar"
import { IconChevronLeft, IconChevronRight } from "./icons"

function HeroCard() {
  return (
    <div className="group relative w-full overflow-hidden rounded-2xl border border-white/8 bg-[#1a1a1a] shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-all duration-500">
      <div
        className="relative flex min-h-[280px] w-full flex-col items-center justify-center px-8 py-16 sm:min-h-[320px] sm:py-20"
        style={{
          backgroundImage: "url(/landing-bg.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-black/10 transition-opacity duration-300 group-hover:bg-black/30"
          aria-hidden
        />
        
        <p className="relative z-1 flex flex-col items-center text-center text-[clamp(1.5rem,4vw,2.25rem)] font-semibold leading-tight tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:-translate-y-2">
          Start by generating a free image
          
          <span className="mt-6 flex flex-col items-center gap-3 opacity-0 transition-all duration-300 group-hover:opacity-100 sm:flex-row sm:gap-4">
            <button className="flex h-10 items-center gap-2 rounded-full bg-white px-6 text-[14px] font-semibold text-black transition hover:bg-white/90 active:scale-95 shadow-lg">
              Generate Image
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12L10 7L5 2" />
              </svg>
            </button>
            <button className="flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-[14px] font-semibold text-white backdrop-blur-md transition hover:bg-white/10 active:scale-95 shadow-lg">
              Generate Video
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12L10 7L5 2" />
              </svg>
            </button>
          </span>
        </p>
      </div>
    </div>
  )
}

function CarouselControls() {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button
        type="button"
        aria-label="Previous"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-[#262626] text-[#9CA3AF] transition hover:border-white/20 hover:text-white"
      >
        <IconChevronLeft />
      </button>
      <button
        type="button"
        aria-label="Next"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-[#262626] text-[#9CA3AF] transition hover:border-white/20 hover:text-white"
      >
        <IconChevronRight />
      </button>
    </div>
  )
}

const toolCards = [
  {
    id: "image",
    label: "Image",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <rect x="4" y="7" width="20" height="14" rx="2" stroke="#2563EB" strokeWidth="2" />
        <circle cx="10" cy="13" r="2" fill="#2563EB" />
        <path d="M4 19L10 13L14 17L18 13L24 19" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    bg: "linear-gradient(135deg, #FDE047 0%, #FACC15 40%, #EAB308 100%)",
    art: (
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 30% 70%, #f472b6 0%, transparent 45%), radial-gradient(circle at 70% 40%, #38bdf8 0%, transparent 40%), linear-gradient(160deg, #fef08a 0%, #f59e0b 100%)",
        }}
      />
    ),
    showTooltip: true,
  },
  {
    id: "video",
    label: "Video",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <rect x="5" y="8" width="14" height="12" rx="2" stroke="#F97316" strokeWidth="2" />
        <path d="M19 11L24 8V20L19 17V11Z" fill="#F97316" />
      </svg>
    ),
    bg: "#0f0f0f",
    art: (
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, #1e293b 0%, #020617 70%), radial-gradient(ellipse at 50% 100%, #334155 0%, transparent 50%)",
        }}
      />
    ),
  },
  {
    id: "enhancer",
    label: "Enhancer",
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
        <rect x="3" y="3" width="20" height="20" rx="3" fill="#0a0a0a" stroke="#fff" strokeWidth="1.5" />
        <path d="M8 18L16 8M14 6L18 10L16 12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="19" cy="7" r="1.2" fill="#fff" />
      </svg>
    ),
    bg: "#111",
    art: (
      <div
        className="absolute inset-0 grayscale contrast-125"
        style={{
          background:
            "linear-gradient(120deg, #404040 0%, #a3a3a3 35%, #171717 100%), radial-gradient(circle at 60% 30%, #fff 0%, transparent 25%)",
        }}
      />
    ),
  },
  {
    id: "edit",
    label: "Edit",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <path d="M16 6L22 12L10 24H4V18L16 6Z" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" fill="#2563EB" fillOpacity="0.25" />
        <path d="M14 8L20 14" stroke="#93C5FD" strokeWidth="1.5" />
      </svg>
    ),
    bg: "#1c1917",
    art: (
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(145deg, #44403c 0%, #292524 50%, #0c0a09 100%), radial-gradient(ellipse at 40% 60%, #78716c 0%, transparent 55%)",
        }}
      />
    ),
  },
] as const

function ToolStrip() {
  return (
    <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {toolCards.map((card) => (
        <div key={card.id} className="relative">
          {"showTooltip" in card && card.showTooltip && (
            <div
              className="absolute -top-[52px] left-1/2 z-10 hidden -translate-x-1/2 sm:block"
              role="tooltip"
            >
              <div className="relative rounded-lg bg-[#2563EB] px-3 py-2 shadow-lg">
                <div className="flex items-center gap-2 whitespace-nowrap text-[12px] font-medium text-white">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                  Click here to open the image tool.
                </div>
                <div
                  className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-[#2563EB]"
                  aria-hidden
                />
              </div>
            </div>
          )}
          <button
            type="button"
            className="group relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-white/8 bg-[#1a1a1a] text-left shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition hover:border-white/15 hover:shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
            style={{ background: card.bg }}
          >
            {card.art}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/25 shadow-[0_4px_24px_rgba(0,0,0,0.35)] backdrop-blur-[2px] ring-1 ring-white/10 transition group-hover:bg-black/35">
                {card.icon}
              </span>
            </div>
          </button>
        </div>
      ))}
    </div>
  )
}

export function LandingView() {
  return (
    <div className="flex min-h-screen bg-black font-sans text-white">
      <LandingSidebar />
      <main className="min-h-screen flex-1 bg-[#1A1A1A] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <HeroCard />
          <CarouselControls />
          <ToolStrip />
        </div>
      </main>
    </div>
  )
}
