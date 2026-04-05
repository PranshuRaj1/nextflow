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
  { label: "Image", href: "#", icon: <IconImage className="text-[#3B82F6]" /> },
  { label: "Video", href: "#", icon: <IconVideo /> },
  { label: "Enhancer", href: "#", icon: <IconWand className="text-white" /> },
  { label: "Nano Banana", href: "#", icon: <IconBanana /> },
  { label: "Realtime", href: "#", icon: <IconBolt /> },
  { label: "Edit", href: "#", icon: <IconBrush /> },
]

function NavRow({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight text-white transition-all ${
        item.active ? "bg-[#262626]" : "text-white hover:bg-white/5"
      } ${isCollapsed ? "justify-center" : ""}`}
      title={isCollapsed ? item.label : ""}
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{item.icon}</span>
      {!isCollapsed && <span className="transition-opacity duration-300 opacity-100">{item.label}</span>}
    </Link>
  )
}

export function LandingSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside 
      className={`flex h-full shrink-0 flex-col border-r border-white/6 bg-black transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-[68px]" : "w-[220px]"
      } px-3 pb-6 pt-5`}
    >
      <div className={`mb-6 flex justify-center ${isCollapsed ? "" : "px-2"}`}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/5 transition-colors focus:outline-none"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <LogoMark className="text-white" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
        {mainNav.map((item) => (
          <NavRow key={item.label} item={item} isCollapsed={isCollapsed} />
        ))}
      </nav>

      <p className={`mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] transition-opacity duration-300 ${
        isCollapsed ? "opacity-0" : "opacity-100"
      }`}>
        {isCollapsed ? "" : "Tools"}
      </p>
      <nav className="flex flex-col gap-0.5" aria-label="Tools">
        {toolsNav.map((item) => (
          <NavRow key={item.label} item={item} isCollapsed={isCollapsed} />
        ))}
        <Link
          href="#"
          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight text-white/80 transition-all hover:bg-white/5 hover:text-white ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center ${isCollapsed ? "" : "shrink-0"}`}>...</span>
          {!isCollapsed && <span>More</span>}
        </Link>
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <Link 
          href="#" 
          className={`px-3 text-[13px] font-medium text-white hover:text-white/90 transition-all ${
            isCollapsed ? "text-center opacity-0 h-0 overflow-hidden" : "opacity-100"
          }`}
        >
          Pricing
        </Link>
        <div className={`px-1 transition-all ${isCollapsed ? "flex justify-center" : ""}`}>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className={`flex items-center justify-center rounded-xl bg-[#2563EB] text-[14px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition hover:bg-[#1d4ed8] active:scale-[0.99] ${
                  isCollapsed ? "h-9 w-9" : "h-11 w-full"
                }`}
                title={isCollapsed ? "Sign in" : ""}
              >
                {isCollapsed ? (
                   <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                     <path d="M11.25 9H3.75M3.75 9L6 6.75M3.75 9L6 11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                     <path d="M7 3.5H12C13.1046 3.5 14 4.39543 14 5.5V12.5C14 13.6046 13.1046 14.5 12 14.5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                   </svg>
                ) : "Sign in"}
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <div className={`flex justify-center py-2 transition-transform ${isCollapsed ? "scale-90" : "scale-110"}`}>
              <UserButton />
            </div>
          </Show>
        </div>
      </div>
    </aside>
  )
}
