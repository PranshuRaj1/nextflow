"use client"

import Link from "next/link"
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
  { label: "Home", href: "/", icon: <IconHome className="text-white" />, active: true },
  { label: "Train Lora", href: "#", icon: <IconTrainLora /> },
  { label: "Node Editor", href: "/workflow", icon: <IconNodeEditor /> },
  { label: "Assets", href: "#", icon: <IconFolder /> },
]

const toolsNav: NavItem[] = [
  { label: "Image", href: "#", icon: <IconImage className="text-[#3B82F6]" /> },
  { label: "Video", href: "#", icon: <IconVideo /> },
  { label: "Enhancer", href: "#", icon: <IconWand className="text-white" /> },
  { label: "Nano Banana", href: "#", icon: <IconBanana /> },
  { label: "Realtime", href: "#", icon: <IconBolt /> },
  { label: "Edit", href: "#", icon: <IconBrush /> },
]

function NavRow({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight text-white transition-colors ${
        item.active ? "bg-[#262626]" : "text-white hover:bg-white/5"
      }`}
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{item.icon}</span>
      {item.label}
    </Link>
  )
}

export function LandingSidebar() {
  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-white/6 bg-black px-3 pb-6 pt-5">
      <div className="mb-6 flex justify-center px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white/90">
          <LogoMark className="text-white" />
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
        {mainNav.map((item) => (
          <NavRow key={item.label} item={item} />
        ))}
      </nav>

      <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Tools</p>
      <nav className="flex flex-col gap-0.5" aria-label="Tools">
        {toolsNav.map((item) => (
          <NavRow key={item.label} item={item} />
        ))}
        <Link
          href="#"
          className="rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight text-white/80 hover:bg-white/5 hover:text-white"
        >
          ... More
        </Link>
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <Link href="#" className="px-3 text-[13px] font-medium text-white hover:text-white/90">
          Pricing
        </Link>
        <div className="px-1">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="h-11 w-full rounded-xl bg-[#2563EB] text-[14px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition hover:bg-[#1d4ed8] active:scale-[0.99]"
              >
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <div className="flex justify-center py-2 [&_.cl-userButtonBox]:scale-110">
              <UserButton />
            </div>
          </Show>
        </div>
      </div>
    </aside>
  )
}
