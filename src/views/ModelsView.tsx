import { useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";
import type { ModelProviderId, TaskCategory } from "../types/jarvis";

interface ModelsViewProps {
  store: JarvisStore;
}

const TASK_CATEGORIES: TaskCategory[] = [
  "Coding",
  "Web Development",
  "Research",
  "Writing",
  "Diagnostics",
  "General",
];

export function ModelsView({ store }: ModelsViewProps) {
  const {
    state,
    autoScanReport,
    testGeminiConnection,
    runAutoScanAndHeal,
    setRoutingPreference,
    setDefaultModel,
  } = store;
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const handleTest = async (id: ModelProviderId) => {
    if (id !== "gemini") {
      setTestMessage(
        `${id.toUpperCase()} is not connected. Add a dedicated server-side backend proxy before marking it connected.`
      );
      return;
    }
    setTestingId(id);
    setTestMessage(null);
    const res = await testGeminiConnection();
    if (res.ok) {
      const scan = await runAutoScanAndHeal({
        trigger: "api_connected",
        autoHeal: state.uiPrefs.autoHealOnConnect,
        postToChat: false,
      });
      setTestingId(null);
      setTestMessage(
        `Verified ${res.data.model} in ${res.data.latencyMs}ms · Auto-Scan: ${scan.summary}`
      );
    } else {
      setTestingId(null);
      setTestMessage(`Connection test failed: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6">
      <section className="jarvis-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-blue-500/25">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Multi-AI Model Network
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Models remain marked as Not Connected until verified through a real server-side API test.
              Server secrets are managed externally in Settings &gt; Secrets.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleTest("gemini")}
            disabled={testingId === "gemini"}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {testingId === "gemini" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Test Gemini Connection</span>
          </button>
        </div>

        {testMessage && (
          <div className="mt-4 p-3 rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-xs text-zinc-700 dark:text-zinc-300">
            {testMessage}
          </div>
        )}

        {autoScanReport && (
          <div className="mt-4 p-4 rounded-xl bg-violet-50/70 dark:bg-[#141132] border border-violet-200 dark:border-violet-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                {autoScanReport.status === "scanning"
                  ? "Scanning Program & Device Environment..."
                  : autoScanReport.status === "healed"
                  ? "API Active · Program Issues Auto-Fixed"
                  : autoScanReport.status === "issues_found"
                  ? "API Active · Issues Detected"
                  : "API Active · Auto-Scan Healthy"}
              </p>
              <p className="text-xs text-zinc-600 dark:text-slate-300">{autoScanReport.summary}</p>
            </div>
            <button
              type="button"
              disabled={autoScanReport.status === "scanning"}
              onClick={() =>
                runAutoScanAndHeal({ trigger: "manual", autoHeal: true, postToChat: false })
              }
              className="px-3 py-1.5 rounded-lg text-xs font-medium jarvis-gradient-btn text-white whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {autoScanReport.status === "scanning" ? "Scanning..." : "Scan & Self-Heal"}
            </button>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.models.map((model) => {
            const isVerified = model.status === "verified";
            const isError = model.status === "error";
            return (
              <div
                key={model.id}
                className="p-5 jarvis-subsurface flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {model.name}
                      </h3>
                      <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {model.modelSlug} · {model.provider}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${
                        isVerified
                          ? "text-emerald-700 dark:text-emerald-400"
                          : isError
                          ? "text-red-600 dark:text-red-400"
                          : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {isVerified ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isVerified
                          ? "Verified Connected"
                          : model.status === "configured_untested"
                          ? "Server Ready · Untested"
                          : isError
                          ? "Connection Error"
                          : "Not Connected"}
                      </span>
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {model.statusNote}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Strengths: {model.strengths.join(" · ")}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-blue-500/25">
                  <div className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                    {model.lastLatencyMs ? `Latency: ${model.lastLatencyMs}ms` : "No telemetry yet"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDefaultModel(model.id)}
                      disabled={model.isDefault || model.status === "not_connected"}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200 dark:border-blue-500/30 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-40 whitespace-nowrap"
                    >
                      {model.isDefault ? "Default Model" : "Set Default"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTest(model.id)}
                      disabled={testingId === model.id}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 whitespace-nowrap"
                    >
                      Test
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Task-Based Routing Matrix */}
      <section className="jarvis-surface p-6">
        <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Intelligent Task-Based Model Routing
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Configure preferred routing per task category. Unconnected external providers fall back to
          the verified Google Gemini backend automatically.
        </p>

        <div className="mt-4 divide-y divide-zinc-100 dark:divide-blue-500/15">
          {TASK_CATEGORIES.map((category) => (
            <div
              key={category}
              className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {category}
              </span>
              <select
                value={state.routing[category]}
                onChange={(e) => setRoutingPreference(category, e.target.value as ModelProviderId)}
                aria-label={`Select model for ${category}`}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-800 dark:text-zinc-200"
              >
                {state.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.status === "not_connected" ? "(Not Connected — Fallback to Gemini)" : "(Available)"}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
