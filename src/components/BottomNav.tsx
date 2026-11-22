import { AudioLines, Brain, Home, Settings, Sparkles } from "lucide-react";
import type { NavView } from "../types/jarvis";

interface BottomNavProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
}

export function BottomNav({ activeView, onSelectView }: BottomNavProps) {
  const leftItems: { id: NavView; label: string; icon: typeof Home }[] = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "brain", label: "Brain", icon: Brain },
  ];

  const rightItems: { id: NavView; label: string; icon: typeof Sparkles }[] = [
    { id: "skills", label: "Skills", icon: Sparkles },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0B0920]/95 backdrop-blur-xl border-t border-violet-200/70 dark:border-violet-400/20 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_-10px_35px_rgba(0,0,0,0.7)] px-2 pt-1.5 pb-2"
    >
      <div className="grid grid-cols-5 items-center max-w-md mx-auto">
        {leftItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {/* Center Floating Neon Voice / AI Chat Orb Button */}
        <div className="flex items-center justify-center -mt-6">
          <button
            type="button"
            onClick={() => onSelectView("assistant")}
            aria-label="Open JARVIS AI Chat"
            className="jarvis-gradient-btn relative w-14 h-14 rounded-full flex items-center justify-center text-white transition-transform active:scale-95"
            style={{
              border: "2px solid rgba(255, 255, 255, 0.38)",
            }}
          >
            <AudioLines className="w-6 h-6" />
          </button>
        </div>

        {rightItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
