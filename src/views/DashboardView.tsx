import { useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Bot,
  Code2,
  Globe,
  MessageSquare,
  Rocket,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import { JarvisOrb } from "../components/JarvisOrb";
import type { JarvisStore } from "../hooks/useJarvisStore";

interface DashboardViewProps {
  store: JarvisStore;
}

const HERO_CYBORG_URL = "/src/assets/images/jarvis_hero_cyborg_1795331885950.jpg";

export function DashboardView({ store }: DashboardViewProps) {
  const {
    state,
    autoScanReport,
    runAutoScanAndHeal,
    appendChatMessages,
    setActiveView,
    openSettings,
    openChatWithWebSearch,
  } = store;

  const [quickQuery, setQuickQuery] = useState("");
  const [heroImgError, setHeroImgError] = useState(false);
  const [listeningHome, setListeningHome] = useState(false);

  const userName = state.uiPrefs.userName || "Imran";

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickQuery.trim();
    if (!trimmed) {
      setActiveView("assistant");
      return;
    }
    appendChatMessages([
      {
        id: `msg-${Date.now()}-u`,
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      },
    ]);
    setQuickQuery("");
    setActiveView("assistant");
  };

  const handleHomeVoice = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
      };
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) {
      openSettings("studio");
      return;
    }
    const rec = new Ctor();
    rec.lang = state.uiPrefs.voiceLanguage.includes("Bangla") ? "bn-BD" : "en-US";
    setListeningHome(true);
    rec.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || "";
      if (spoken.trim()) {
        appendChatMessages([
          {
            id: `msg-${Date.now()}-u`,
            role: "user",
            content: spoken.trim(),
            timestamp: new Date().toISOString(),
          },
        ]);
        setActiveView("assistant");
      }
    };
    rec.onerror = () => setListeningHome(false);
    rec.onend = () => setListeningHome(false);
    rec.start();
  };

  const actionTiles = [
    {
      label: "AI Chat",
      icon: MessageSquare,
      iconColor: "text-violet-500 dark:text-violet-400",
      iconBg: "bg-violet-500/15",
      onClick: () => setActiveView("assistant"),
    },
    {
      label: "JARVIS Brain",
      icon: Sparkles,
      iconColor: "text-cyan-500 dark:text-cyan-400",
      iconBg: "bg-cyan-500/15",
      onClick: () => setActiveView("brain"),
    },
    {
      label: "Coding Studio",
      icon: Code2,
      iconColor: "text-emerald-500 dark:text-emerald-400",
      iconBg: "bg-emerald-500/15",
      onClick: () => openSettings("studio"),
    },
    {
      label: "Skills & Tools",
      icon: Zap,
      iconColor: "text-amber-500 dark:text-amber-400",
      iconBg: "bg-amber-500/15",
      onClick: () => setActiveView("skills"),
    },
    {
      label: "Web Search",
      icon: Globe,
      iconColor: "text-rose-500 dark:text-rose-400",
      iconBg: "bg-rose-500/15",
      onClick: openChatWithWebSearch,
    },
    {
      label: "Settings",
      icon: Settings,
      iconColor: "text-indigo-500 dark:text-violet-400",
      iconBg: "bg-indigo-500/15",
      onClick: () => openSettings("general"),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Cosmic Cyborg Hero Banner + Greeting + Floating Ask Input */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-300/70 dark:border-violet-400/25 bg-[#0A0820] shadow-[0_14px_40px_-10px_rgba(76,29,149,0.45)]">
        {/* Background Cyborg + Earth Artwork */}
        <div className="relative h-56 sm:h-64 w-full overflow-hidden">
          {!heroImgError ? (
            <img
              src={HERO_CYBORG_URL}
              alt="JARVIS Cosmic Cyborg Assistant"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgError(true)}
              className="w-full h-full object-cover object-right sm:object-center opacity-95"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-end pr-8"
              style={{
                background:
                  "radial-gradient(circle at 70% 35%, rgba(56,189,248,0.28), rgba(109,40,217,0.35), #060516 78%)",
              }}
            >
              <Bot className="w-24 h-24 text-cyan-300/60" />
            </div>
          )}

          {/* Scrim for guaranteed 4.5:1+ text contrast */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#060516]/95 via-[#060516]/65 to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#08071B] via-[#08071B]/75 to-transparent"
          />

          {/* Top-left Glowing Orb + JARVIS Wordmark */}
          <div className="absolute left-5 sm:left-7 top-6 sm:top-8 flex items-center gap-3.5 max-w-[65%]">
            <JarvisOrb
              size="md"
              animated={state.uiPrefs.backgroundAnimation}
              active={listeningHome}
            />
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white">
                JARVIS
              </h1>
              <p className="text-xs sm:text-sm text-violet-100/90">
                Your Personal AI Assistant
              </p>
            </div>
          </div>
        </div>

        {/* Greeting + Floating "Ask me anything..." Bar */}
        <div className="relative px-5 sm:px-7 pb-5 -mt-6 space-y-3.5">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Hello, <span className="text-violet-400">{userName}</span>{" "}
              <span aria-hidden="true">👋</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              What would you like to do today?
            </p>
          </div>

          <form
            onSubmit={handleQuickAsk}
            className="flex items-center gap-2.5 p-1.5 rounded-full bg-[#100D28]/95 border border-violet-400/35 shadow-[0_0_24px_rgba(124,58,237,0.28)]"
          >
            <button
              type="button"
              onClick={handleHomeVoice}
              aria-label="Speak command to JARVIS"
              title="Voice Input"
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                listeningHome
                  ? "bg-rose-600 text-white shadow-[0_0_16px_rgba(244,63,94,0.65)]"
                  : "bg-[#1C1642] text-violet-300 border border-violet-400/30 hover:text-white"
              }`}
            >
              <AudioLines className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-slate-400 px-1 focus:outline-none"
            />

            <button
              type="submit"
              aria-label="Send query to JARVIS"
              className="jarvis-gradient-btn w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 transition-transform active:scale-95"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>

      {/* 3x2 Quick Action Tiles Grid */}
      <section className="grid grid-cols-3 gap-3 sm:gap-4" aria-label="Quick Actions">
        {actionTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.label}
              type="button"
              onClick={tile.onClick}
              className="jarvis-surface p-4 sm:p-5 flex flex-col items-center justify-center gap-2.5 text-center transition-transform duration-150 hover:-translate-y-0.5 hover:border-violet-400/50 active:scale-[0.98]"
            >
              <div
                className={`w-11 h-11 rounded-2xl ${tile.iconBg} flex items-center justify-center`}
              >
                <Icon className={`w-5 h-5 ${tile.iconColor}`} />
              </div>
              <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-slate-100 whitespace-nowrap truncate max-w-full">
                {tile.label}
              </span>
            </button>
          );
        })}
      </section>

      {/* Quick Access Banner */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
            Quick Access
          </h3>
          <button
            type="button"
            onClick={() => setActiveView("skills")}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            <span>See All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="jarvis-surface p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-500 dark:text-violet-400 shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.25)]">
              <Rocket className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm sm:text-base font-semibold text-zinc-900 dark:text-white truncate">
                Boost Your Productivity
              </p>
              <p className="text-xs text-zinc-500 dark:text-slate-400 truncate">
                With JARVIS AI · {state.skills.filter((s) => s.enabled).length} Active Skills
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView("approvals")}
            className="jarvis-gradient-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white whitespace-nowrap shrink-0"
          >
            <span>Explore</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {autoScanReport && (
          <div className="jarvis-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-zinc-900 dark:text-white truncate">
                {autoScanReport.status === "scanning"
                  ? "Scanning program & website health..."
                  : autoScanReport.status === "healed"
                  ? `Auto-Healed ${autoScanReport.fixesApplied.length} Issue(s)`
                  : autoScanReport.status === "issues_found"
                  ? `${autoScanReport.issuesFound.length} Issue(s) Detected`
                  : "API Active · System & Program Verified"}
              </p>
              <p className="text-zinc-500 dark:text-slate-400 truncate mt-0.5">
                {autoScanReport.summary}
              </p>
            </div>
            <button
              type="button"
              disabled={autoScanReport.status === "scanning"}
              onClick={() =>
                runAutoScanAndHeal({ trigger: "manual", autoHeal: true, postToChat: true })
              }
              className="px-3.5 py-1.5 rounded-full border border-violet-300 dark:border-violet-400/35 text-violet-700 dark:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-500/15 font-medium whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {autoScanReport.status === "scanning" ? "Scanning..." : "Scan & Auto-Fix"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
