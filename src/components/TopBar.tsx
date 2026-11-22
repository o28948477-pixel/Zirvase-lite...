import { Bell, Crown, Menu } from "lucide-react";
import type { NavView } from "../types/jarvis";

interface TopBarProps {
  activeView: NavView;
  pendingApprovalsCount: number;
  onOpenMobileNav: () => void;
  onNavigate: (view: NavView) => void;
}

const VIEW_HEADERS: Record<NavView, string> = {
  welcome: "JARVIS",
  dashboard: "JARVIS",
  assistant: "JARVIS Chat",
  brain: "JARVIS Brain",
  models: "Settings",
  skills: "Skills & Tools",
  coding: "Settings",
  github: "Settings",
  memory: "Settings",
  voice: "Settings",
  diagnostics: "Settings",
  evolution: "Settings",
  approvals: "Update Center",
  settings: "Settings",
};

export function TopBar({
  activeView,
  pendingApprovalsCount,
  onOpenMobileNav,
  onNavigate,
}: TopBarProps) {
  const title = VIEW_HEADERS[activeView];

  return (
    <header
      className={`sticky top-0 z-30 bg-white/90 dark:bg-[#08071C]/85 backdrop-blur-xl border-b border-violet-200/70 dark:border-violet-400/18 ${
        activeView === "assistant" ? "hidden lg:block" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-8 px-4 sm:px-8 h-14 max-w-[1160px] mx-auto w-full">
        {/* Zone 1: Menu + Brand Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open menu"
            className="lg:hidden min-w-[40px] min-h-[40px] -ml-2 flex items-center justify-center rounded-xl text-zinc-700 hover:text-zinc-900 dark:text-slate-200 dark:hover:text-white hover:bg-violet-50 dark:hover:bg-violet-500/15"
          >
            <Menu className="w-5 h-5" />
          </button>

          <span className="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0">
            {title}
          </span>
        </div>

        {/* Zone 2: Clean Single-Line Core Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-zinc-600 dark:text-slate-300">
          {(
            [
              { id: "dashboard", label: "Home" },
              { id: "assistant", label: "AI Chat" },
              { id: "brain", label: "Brain" },
              { id: "skills", label: "Skills" },
              { id: "settings", label: "Settings" },
            ] as { id: NavView; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeView === item.id ? "text-violet-600 dark:text-violet-400" : ""
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Crown (Settings/Profile) + Notification Bell (Update Center) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            aria-label="Profile & Settings"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-amber-500 dark:text-amber-400 hover:bg-violet-50 dark:hover:bg-violet-500/15 transition-colors"
          >
            <Crown className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("approvals")}
            aria-label="Open Update Center"
            className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-violet-200 dark:border-violet-400/30 bg-violet-50/70 dark:bg-[#141132] text-zinc-800 dark:text-slate-100 hover:border-violet-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Bell className="w-4 h-4 text-violet-600 dark:text-violet-300" />
            <span className="hidden sm:inline text-xs font-medium">Updates</span>
            {pendingApprovalsCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-violet-600 text-[10px] font-mono tabular-nums font-bold text-white flex items-center justify-center">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
