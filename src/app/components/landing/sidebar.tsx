"use client"

import { useState } from "react"

import Link from "next/link"
import Image from "next/image"
import { Show, SignInButton, UserButton } from "@clerk/nextjs"
import {
  LogoMark,
  IconHome,
  IconTrainLora,
  IconNodeEditor,
  IconFolder,
  IconImage,
  IconVideo,
  IconWand,
  IconBanana,
  IconBolt,
  IconBrush,
  IconLipsync,
  IconMotion,
  Icon3D,
  IconRestyle,
} from "./icons"

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  active?: boolean
}

const mainNav: NavItem[] = [
  { 
    label: "Home", 
    href: "/", 
    icon: <Image src="/home.webp" alt="Home" width={18} height={18} className="rounded-[4px]" />, 
    active: true 
  },
  { 
    label: "Train Lora", 
    href: "#", 
    icon: <Image src="/train lora.webp" alt="Train Lora" width={18} height={18} className="rounded-[4px]" /> 
  },
  { 
    label: "Node Editor", 
    href: "/workflow", 
    icon: <Image src="/node editor.webp" alt="Node Editor" width={18} height={18} className="rounded-[4px]" /> 
  },
  { 
    label: "Assets", 
    href: "#", 
    icon: <Image src="/assets.webp" alt="Assets" width={18} height={18} className="rounded-[4px]" /> 
  },
]

const toolsNav: NavItem[] = [
  { 
    label: "Image", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-imageV4-png-128.webp" alt="Image" width={20} height={20} className="rounded-[4px]" /> 
  },
  { 
    label: "Video", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-videoV2-png-128.webp" alt="Video" width={20} height={20} className="rounded-[4px]" /> 
  },
  { 
    label: "Enhancer", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-Enhance-png-128.webp" alt="Enhancer" width={20} height={20} className="rounded-[4px]" /> 
  },
  { 
    label: "Nano Banana", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-NanoBanana-png-128.webp" alt="Nano Banana" width={20} height={20} className="rounded-[4px]" /> 
  },
  { 
    label: "Realtime", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-realtimeV2-png-128.webp" alt="Realtime" width={20} height={20} className="rounded-[4px]" /> 
  },
  { 
    label: "Edit", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-Edit-png-128.webp" alt="Edit" width={20} height={20} className="rounded-[4px]" /> 
  },
]

const extraNav: NavItem[] = [
  { 
    label: "Video Lipsync", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-lipsync-png-128.webp" alt="Video Lipsync" width={20} height={20} className="rounded-[4px]" /> 
  },
  { 
    label: "Motion Transfer", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-MotionTransfer-png-128.webp" alt="Motion Transfer" width={20} height={20} className="rounded-[4px]" /> 
  },
  { 
    label: "3D Objects", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-ThreeD-png-128.webp" alt="3D Objects" width={20} height={20} className="rounded-[4px]" /> 
  },
  { 
    label: "Video Restyle", 
    href: "#", 
    icon: <Image src="https://optim-images.krea.ai/https---s-krea-ai-icons-VideoRestyle2-png-128.webp" alt="Video Restyle" width={20} height={20} className="rounded-[4px]" /> 
  },
]

function NavRow({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) {
  return (
    <Link
      href={item.href}
      className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[14.5px] font-medium tracking-tight text-white/90 transition-all ${
        item.active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
      } ${isCollapsed ? "justify-center" : ""}`}
      title={isCollapsed ? item.label : ""}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
        {!isCollapsed && <span className="transition-opacity duration-300 opacity-100">{item.label}</span>}
      </div>
      {!isCollapsed && item.label === "Enhancer" && (
        <span className="text-white/40 opacity-0 transition-opacity group-hover:opacity-100 italic font-mono text-[16px] pr-1">...</span>
      )}
    </Link>
  )
}

export function LandingSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showMore, setShowMore] = useState(false)

  return (
    <aside 
      className={`sticky top-0 h-screen shrink-0 border-r border-white/6 bg-[#0a0a0a] transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-[68px]" : "w-[280px]"
      } flex flex-col px-2.5 pb-8 pt-5`}
    >
      <div className={`mb-6 flex ${isCollapsed ? "justify-center" : "px-2.5 justify-start"}`}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/5 transition-colors focus:outline-none"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <LogoMark className="text-white" />
        </button>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Primary">
        {mainNav.map((item) => (
          <NavRow key={item.label} item={item} isCollapsed={isCollapsed} />
        ))}
      </nav>

      <p className={`mb-2 mt-7 px-3 text-[11px] font-bold uppercase tracking-[0.05em] text-white/35 transition-opacity duration-300 ${
        isCollapsed ? "opacity-0" : "opacity-100"
      }`}>
        {isCollapsed ? "" : "Tools"}
      </p>
      <nav className="flex flex-col gap-1" aria-label="Tools">
        {toolsNav.map((item) => (
          <NavRow key={item.label} item={item} isCollapsed={isCollapsed} />
        ))}
        {showMore && (
          <div className="flex flex-col gap-1">
            {extraNav.map((item) => (
              <NavRow key={item.label} item={item} isCollapsed={isCollapsed} />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] font-medium tracking-tight text-white/50 transition-all hover:bg-white/5 hover:text-white ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${isCollapsed ? "" : "shrink-0"} italic font-mono text-[16px]`}>
            {showMore ? "..." : "..."}
          </span>
          {!isCollapsed && <span>{showMore ? "Less" : "More"}</span>}
        </button>
      </nav>

      <div className="mt-8">
        <p className={`mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.05em] text-white/35 transition-opacity duration-300 ${
          isCollapsed ? "opacity-0" : "opacity-100"
        }`}>
          {isCollapsed ? "" : "Sessions"}
        </p>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-4 pt-4">
        {!isCollapsed && (
          <p className="px-3 text-[13px] font-medium text-white/90">
             Earn 3,000 Credits
          </p>
        )}
        
        <div className={`px-1 transition-all ${isCollapsed ? "flex justify-center" : ""}`}>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className={`flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-[14.5px] font-semibold text-white shadow-[0_1px_20px_rgba(37,99,235,0.25)] transition-all hover:brightness-110 active:scale-[0.98] ${
                  isCollapsed ? "h-11 w-11" : "h-12 w-full"
                }`}
                title={isCollapsed ? "Sign in" : ""}
              >
                {isCollapsed ? (
                   <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                     <path d="M11.25 9H3.75M3.75 9L6 6.75M3.75 9L6 11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                     <path d="M7 3.5H12C13.1046 3.5 14 4.39543 14 5.5V12.5C14 13.6046 13.1046 14.5 12 14.5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                   </svg>
                ) : "Upgrade"}
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
             <div className={`flex w-full items-center gap-3.5 rounded-xl p-2.5 transition-colors hover:bg-white/5 ${isCollapsed ? "justify-center" : ""}`}>
               <div className={`transition-transform ${isCollapsed ? "scale-100" : "scale-110"}`}>
                 <UserButton appearance={{ elements: { userButtonAvatarBox: "w-9 h-9 rounded-lg" } }} />
               </div>
               {!isCollapsed && (
                 <div className="flex flex-col min-w-0 ml-1">
                    <span className="truncate text-[14px] font-semibold text-white">superrichcat</span>
                    <span className="text-[12px] font-medium text-white/40">Free</span>
                 </div>
               )}
             </div>
          </Show>
        </div>
      </div>
    </aside>
  )
}
