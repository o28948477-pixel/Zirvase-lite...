import { useState } from "react";
import {
  ArrowRight,
  Brain,
  ChevronRight,
  Database,
  Heart,
  Loader2,
  MessageSquareText,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";
import type { BrainTrace } from "../types/jarvis";
import { resolveApiUrl } from "../utils/apiUrl";

interface BrainViewProps {
  store: JarvisStore;
}

const NEURAL_BRAIN_ART = "/src/assets/images/jarvis_neural_brain_1795233558825.jpg";

export function BrainView({ store }: BrainViewProps) {
  const { state, setActiveView, openSettings } = store;
  const [command, setCommand] = useState("Amar jonno ekta responsive weather dashboard banao");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ trace: BrainTrace; response: string } | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [showTracer, setShowTracer] = useState(false);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || analyzing) return;

    setAnalyzing(true);
    setError(null);
    try {
      const resp = await fetch(resolveApiUrl("/api/gemini/brain"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: command.trim(),
          memories: state.memories
            .filter((m) => m.activeInContext)
            .map((m) => ({ type: m.type, title: m.title, content: m.content })),
          activeSkills: state.skills
            .filter((s) => s.installed && s.enabled)
            .map((s) => s.name),
          routingPreferences: state.routing,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Brain analysis failed.");

      setResult({
        trace: {
          category: data.category,
          executedModel: data.executedModel,
          selectedSkills: data.selectedSkills || [],
          reasoning: data.reasoning,
          executionPlan: data.executionPlan || [],
          latencyMs: data.latencyMs,
          suggestedActionType: data.suggestedActionType,
        },
        response: data.response,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to inspect AI Brain.");
    } finally {
      setAnalyzing(false);
    }
  };

  const activeMemories = state.memories.filter((m) => m.activeInContext);
  const userQuestionsCount =
    state.memories.length + state.messages.filter((m) => m.role === "user").length;

  const brainCapabilities = [
    {
      title: "Emotion Recognition",
      subtitle: `Current Mood: ${state.uiPrefs.detectedMood}`,
      icon: Heart,
      iconColor: "text-rose-400 bg-rose-500/15 border-rose-400/30",
      onClick: () => setActiveView("dashboard"),
    },
    {
      title: "Memory System",
      subtitle: `Long-term Memory (${state.memories.length} entries)`,
      icon: Database,
      iconColor: "text-sky-400 bg-sky-500/15 border-sky-400/30",
      onClick: () => openSettings("memory"),
    },
    {
      title: "Context Awareness",
      subtitle: `Keep Conversation (${activeMemories.length} active)`,
      icon: MessageSquareText,
      iconColor: "text-emerald-400 bg-emerald-500/15 border-emerald-400/30",
      onClick: () => setActiveView("assistant"),
    },
    {
      title: "Feedback Learning",
      subtitle: "Test AI Brain Pipeline & Routing",
      icon: Sparkles,
      iconColor: "text-violet-400 bg-violet-500/15 border-violet-400/30",
      onClick: () => setShowTracer((v) => !v),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <section className="jarvis-surface p-6 text-center space-y-5 overflow-hidden">
        <div className="relative max-w-sm mx-auto">
          {!imgFailed ? (
            <img
              src={NEURAL_BRAIN_ART}
              alt="JARVIS Holographic Neural Brain"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-48 sm:h-56 object-contain mx-auto rounded-2xl dark:mix-blend-screen"
            />
          ) : (
            <div className="w-full h-44 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-400/30">
              <Brain className="w-20 h-20 text-cyan-400" />
            </div>
          )}
          <p className="mt-2 text-xs font-medium tracking-wide text-blue-600 dark:text-cyan-300">
            Learning · Remembering · Improving
          </p>
        </div>

        <div className="space-y-2.5 text-left">
          {brainCapabilities.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={item.onClick}
                className="w-full p-3.5 rounded-xl bg-blue-50/50 dark:bg-[#08122E]/90 border border-blue-200/70 dark:border-sky-400/25 hover:border-blue-400/70 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.iconColor}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>

        <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-[#0B193D] border border-blue-200 dark:border-sky-400/35 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-500 dark:text-cyan-300 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-xs text-zinc-500 dark:text-slate-300">Learned Questions</p>
              <p className="font-display text-xl font-bold tabular-nums text-cyan-600 dark:text-cyan-300">
                {userQuestionsCount}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openSettings("memory")}
            className="jarvis-gradient-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white whitespace-nowrap shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Expandable Brain Pipeline Tracer (opens only when toggled via Feedback Learning) */}
      {showTracer && (
        <section className="jarvis-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
              Test AI Brain Pipeline
            </h3>
            <button
              type="button"
              onClick={() => setShowTracer(false)}
              className="text-xs text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter any command to trace AI Brain..."
              className="flex-1 min-w-0 px-3.5 py-2 text-sm rounded-xl bg-blue-50/50 dark:bg-[#08102A] border border-blue-200 dark:border-sky-400/25 text-zinc-900 dark:text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={analyzing || !command.trim()}
              className="jarvis-gradient-btn inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white disabled:opacity-50 whitespace-nowrap"
            >
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Trace</span>
            </button>
          </form>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/40 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl jarvis-subsurface flex flex-wrap items-center justify-between gap-2">
                <span>
                  Category: <strong>{result.trace.category}</strong>
                </span>
                <span className="font-mono text-blue-600 dark:text-cyan-300">
                  {result.trace.executedModel} · {result.trace.latencyMs}ms
                </span>
              </div>
              <div className="p-3 rounded-xl jarvis-subsurface text-zinc-700 dark:text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto">
                {result.response}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
