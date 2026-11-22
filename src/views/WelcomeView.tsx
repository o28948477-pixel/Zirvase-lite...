import { ArrowRight, BrainCircuit, HeartHandshake, ShieldCheck, UserCheck } from "lucide-react";
import { JarvisOrb } from "../components/JarvisOrb";
import type { JarvisStore } from "../hooks/useJarvisStore";

interface WelcomeViewProps {
  store: JarvisStore;
}

export function WelcomeView({ store }: WelcomeViewProps) {
  const { state, completeWelcome } = store;
  const userName = state.uiPrefs.userName || "Imran";

  const pillars = [
    { label: "Smart AI", icon: BrainCircuit, color: "text-cyan-300 border-cyan-400/40 bg-cyan-500/10" },
    { label: "Secure", icon: ShieldCheck, color: "text-sky-300 border-sky-400/40 bg-sky-500/10" },
    { label: "Personal", icon: UserCheck, color: "text-indigo-300 border-indigo-400/40 bg-indigo-500/10" },
    { label: "Always With You", icon: HeartHandshake, color: "text-teal-300 border-teal-400/40 bg-teal-500/10" },
  ];

  return (
    <div className="min-h-[calc(100vh-7rem)] flex flex-col items-center justify-center py-6 px-4 text-center">
      <div className="w-full max-w-md mx-auto space-y-7">
        {/* Holographic Orb & Pedestal */}
        <JarvisOrb size="hero" animated={state.uiPrefs.backgroundAnimation} />

        {/* Greeting */}
        <div className="space-y-2">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Hello{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              {userName}!
            </span>{" "}
            <span aria-hidden="true">👋</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-slate-300">
            I&apos;m <span className="font-semibold text-blue-500 dark:text-indigo-300">JARVIS</span>. How can I help you today?
          </p>
        </div>

        {/* Primary CTA */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={() => completeWelcome("dashboard")}
            className="jarvis-gradient-btn w-full max-w-xs mx-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-white transition-transform active:scale-[0.98]"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div>
            <button
              type="button"
              onClick={() => completeWelcome("assistant")}
              className="text-xs font-medium text-blue-600 dark:text-cyan-300/85 hover:underline"
            >
              Jump directly to AI Chat
            </button>
          </div>
        </div>

        {/* 4 Bottom Feature Pillars */}
        <div className="grid grid-cols-4 gap-3 pt-4 border-t border-zinc-200/70 dark:border-blue-500/20">
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div
                  className={`w-11 h-11 rounded-full border flex items-center justify-center shadow-[0_0_16px_rgba(56,189,248,0.2)] ${item.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-medium text-zinc-600 dark:text-slate-300 leading-tight">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
