import type { ComponentType } from "react";
import {
  Bot,
  Brain,
  CheckSquare,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import type { NavView } from "../types/jarvis";
import { JarvisOrb } from "./JarvisOrb";
import { PWAInstallButton } from "./PWAInstallButton";

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  pendingApprovalsCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: NavView;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "assistant", label: "AI Chat", icon: Bot },
  { id: "brain", label: "JARVIS Brain", icon: Brain },
  { id: "skills", label: "Skills & Tools", icon: Package },
  { id: "approvals", label: "Update Center", icon: CheckSquare },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  activeView,
  onSelectView,
  pendingApprovalsCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleSelect = (id: NavView) => {
    onSelectView(id);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex h-full flex-col bg-white/95 dark:bg-[#09081E]/95 backdrop-blur-xl border-r border-violet-200/70 dark:border-violet-400/20">
      <div className="flex items-center justify-between px-4 h-16 border-b border-violet-200/60 dark:border-violet-400/15">
        <button
          type="button"
          onClick={() => handleSelect("welcome")}
          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-xl"
        >
          <JarvisOrb size="sm" />
          <div>
            <span className="block font-display text-sm font-bold tracking-wider text-zinc-900 dark:text-white whitespace-nowrap">
              JARVIS
            </span>
            <span className="block text-[11px] text-violet-600 dark:text-violet-300 whitespace-nowrap">
              Your Personal AI
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-slate-300 dark:hover:text-white hover:bg-violet-50 dark:hover:bg-violet-500/15"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1.5" aria-label="Primary Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                isActive
                  ? "jarvis-gradient-btn text-white"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-violet-50/80 dark:text-slate-200 dark:hover:text-white dark:hover:bg-violet-500/12"
              }`}
            >
              <span className="flex items-center gap-3 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-white" : "text-violet-500 dark:text-violet-300"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === "approvals" && pendingApprovalsCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-violet-600 text-[11px] font-mono tabular-nums font-semibold text-white flex items-center justify-center">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-4">
          <button
            type="button"
            onClick={() => handleSelect("welcome")}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              activeView === "welcome"
                ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                : "text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Welcome Portal</span>
          </button>
        </div>
      </nav>

      <div className="p-3 border-t border-violet-200/60 dark:border-violet-400/15">
        <PWAInstallButton />
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[236px] shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[264px] max-w-[85vw] h-full shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
