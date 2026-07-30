"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SignInButton, UserButton, Show } from "@clerk/nextjs"
import { Workflow, Home } from "lucide-react"
import { cn } from "@/lib/utils/cn"

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
}

const nav: NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: <Home className="h-4 w-4" />,
  },
  {
    label: "Workflows",
    href: "/workflow",
    icon: <Workflow className="h-4 w-4" />,
  },
]

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium tracking-tight transition-all",
        active
          ? "bg-white/10 text-white"
          : "text-white/60 hover:bg-white/5 hover:text-white",
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-inherit">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  )
}

export function LandingSidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-white/6 bg-[#0a0a0a] px-2.5 pb-8 pt-5">
      {/* Brand */}
      <div className="mb-6 px-2.5">
        <span className="text-[15px] font-bold tracking-tight text-white">
          NextFlow
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1" aria-label="Primary">
        {nav.map((item) => (
          <NavRow
            key={item.label}
            item={item}
            active={pathname === item.href}
          />
        ))}
      </nav>

      <div className="flex-1" />

      {/* User */}
      <div className="px-1">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-[14px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Sign in
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <div className="flex w-full items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5">
            <UserButton
              appearance={{
                elements: { userButtonAvatarBox: "w-8 h-8 rounded-lg" },
              }}
            />
          </div>
        </Show>
      </div>
    </aside>
  )
}
