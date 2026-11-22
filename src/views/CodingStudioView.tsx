import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Play,
  Plus,
  Sparkles,
  Bug,
  HelpCircle,
  Loader2,
  CheckSquare,
  Terminal,
  Trash2,
} from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";
import { resolveApiUrl } from "../utils/apiUrl";
import { buildSingleFileHtml, downloadTextFile } from "../utils/exportHtml";

interface CodingStudioViewProps {
  store: JarvisStore;
}

interface ConsoleEntry {
  id: string;
  level: "log" | "warn" | "error";
  message: string;
  timestamp: string;
}

export function CodingStudioView({ store }: CodingStudioViewProps) {
  const {
    state,
    activeProject,
    updateActiveProjectCode,
    createProject,
    selectProject,
    proposeUpdate,
    setActiveView,
    logActivity,
  } = store;

  const [tab, setTab] = useState<"html" | "css" | "js">("html");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReport, setAiReport] = useState<{
    summary: string;
    explanation: string;
    issuesFound: string[];
    proposedHtml: string;
    proposedCss: string;
    proposedJs: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProj, setShowNewProj] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.source !== "jarvis-studio-preview") return;
      setConsoleLogs((prev) => [
        ...prev.slice(-39),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          level: event.data.level || "log",
          message: String(event.data.message || ""),
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      ]);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Inject lightweight console capture bridge only into live preview srcDoc (kept clean out of exported HTML)
  const previewDoc = useMemo(() => {
    const bridge = `<script>
(function(){
  function send(level, args) {
    try {
      var msg = Array.prototype.slice.call(args).map(function(a){
        return typeof a === "object" ? JSON.stringify(a) : String(a);
      }).join(" ");
      window.parent.postMessage({ source: "jarvis-studio-preview", level: level, message: msg }, "*");
    } catch(e) {}
  }
  var origLog = console.log, origWarn = console.warn, origErr = console.error;
  console.log = function(){ send("log", arguments); origLog.apply(console, arguments); };
  console.warn = function(){ send("warn", arguments); origWarn.apply(console, arguments); };
  console.error = function(){ send("error", arguments); origErr.apply(console, arguments); };
  window.addEventListener("error", function(e){
    send("error", [e.message + " (line " + e.lineno + ")"]);
  });
})();
</script>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${activeProject.css}</style>
  ${bridge}
</head>
<body>
${activeProject.html}
<script>${activeProject.js}</script>
</body>
</html>`;
  }, [activeProject]);

  const exportDoc = useMemo(() => buildSingleFileHtml(activeProject), [activeProject]);

  const runAiCodeAction = async (mode: "generate" | "explain" | "debug" | "improve") => {
    if (mode === "generate" && !aiPrompt.trim()) return;
    setAiBusy(true);
    setError(null);
    try {
      const capturedErrors = consoleLogs
        .filter((l) => l.level === "error")
        .map((l) => l.message);

      const resp = await fetch(resolveApiUrl("/api/gemini/code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt: aiPrompt.trim() || `Run ${mode} on ${activeProject.name}`,
          html: activeProject.html,
          css: activeProject.css,
          js: activeProject.js,
          consoleErrors: capturedErrors,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Coding Studio request failed");

      setAiReport({
        summary: data.summary || "Code analysis complete.",
        explanation: data.explanation || "",
        issuesFound: Array.isArray(data.issuesFound) ? data.issuesFound : [],
        proposedHtml: data.html ?? activeProject.html,
        proposedCss: data.css ?? activeProject.css,
        proposedJs: data.js ?? activeProject.js,
      });
      logActivity("Coding Studio", `AI ${mode} completed`, data.summary || activeProject.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coding Studio error");
    } finally {
      setAiBusy(false);
    }
  };

  const handleQueueCodeProposal = () => {
    if (!aiReport) return;
    proposeUpdate({
      title: `Update ${activeProject.name}: ${aiReport.summary.slice(0, 48)}`,
      source: "Coding Studio",
      area: "Project Code",
      problemOrReason: aiReport.summary,
      proposedSolution: aiReport.explanation.slice(0, 260),
      securityImpact: "Low — updates local Coding Studio project files after owner approval.",
      beforePreview: activeProject.html.slice(0, 200),
      afterPreview: aiReport.proposedHtml.slice(0, 200),
      actionType: "apply_code",
      actionPayload: {
        projectId: activeProject.id,
        html: aiReport.proposedHtml,
        css: aiReport.proposedCss,
        js: aiReport.proposedJs,
      },
    });
    setActiveView("approvals");
  };

  const handleExportSingleHtml = () => {
    const slug = activeProject.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "jarvis-project";
    downloadTextFile(`${slug}.html`, exportDoc, "text/html");
    logActivity("Coding Studio", "Exported Single-File HTML", `${slug}.html`);
  };

  const handleExportSeparateFiles = () => {
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${activeProject.name}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
${activeProject.html}
  <script src="script.js"></script>
</body>
</html>`;
    downloadTextFile("index.html", indexHtml, "text/html");
    downloadTextFile("style.css", activeProject.css, "text/css");
    downloadTextFile("script.js", activeProject.js, "application/javascript");
    logActivity("Coding Studio", "Exported Multi-File Bundle", "index.html, style.css, script.js");
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    createProject(newProjectName.trim(), "Created in JARVIS Coding Studio");
    setNewProjectName("");
    setShowNewProj(false);
    setConsoleLogs([]);
  };

  const activeCode =
    tab === "html" ? activeProject.html : tab === "css" ? activeProject.css : activeProject.js;
  const errorCount = consoleLogs.filter((l) => l.level === "error").length;

  return (
    <div className="space-y-6">
      <section className="jarvis-surface p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-blue-500/25">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={activeProject.id}
              onChange={(e) => {
                selectProject(e.target.value);
                setConsoleLogs([]);
              }}
              aria-label="Select Coding Studio project"
              className="px-3 py-2 text-xs font-medium rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
            >
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowNewProj((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-blue-500/30 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportSeparateFiles}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-blue-500/30 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Multi-File</span>
            </button>
            <button
              type="button"
              onClick={handleExportSingleHtml}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Single HTML</span>
            </button>
          </div>
        </div>

        {showNewProj && (
          <form onSubmit={handleCreateProject} className="flex gap-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name..."
              className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
            >
              Create
            </button>
          </form>
        )}

        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder='Describe what to build or improve (e.g. "Build a dark/light unit converter widget")'
            className="flex-1 min-w-0 px-3.5 py-2 text-sm rounded-xl bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
          />
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              disabled={aiBusy || !aiPrompt.trim()}
              onClick={() => runAiCodeAction("generate")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {aiBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>Generate</span>
            </button>
            <button
              type="button"
              disabled={aiBusy}
              onClick={() => runAiCodeAction("explain")}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-blue-500/30 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Explain</span>
            </button>
            <button
              type="button"
              disabled={aiBusy}
              onClick={() => runAiCodeAction("debug")}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-blue-500/30 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Debug{errorCount > 0 ? ` (${errorCount})` : ""}</span>
            </button>
            <button
              type="button"
              disabled={aiBusy}
              onClick={() => runAiCodeAction("improve")}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-blue-500/30 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Improve</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {aiReport && (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                AI Review · {aiReport.summary}
              </h3>
              <button
                type="button"
                onClick={handleQueueCodeProposal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap self-start"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Send Diff to Approval Center</span>
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
              {aiReport.explanation}
            </p>
            {aiReport.issuesFound.length > 0 && (
              <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                {aiReport.issuesFound.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Split Editor + Sandboxed Live Preview & Console */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="jarvis-surface overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-blue-500/25">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {(["html", "css", "js"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 text-xs font-mono font-medium rounded-md uppercase transition-colors ${
                    tab === t
                      ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Direct Editor</span>
          </div>

          <textarea
            value={activeCode}
            onChange={(e) => updateActiveProjectCode({ [tab]: e.target.value })}
            spellCheck={false}
            aria-label={`${tab.toUpperCase()} editor`}
            className="w-full h-[380px] p-4 font-mono text-xs leading-relaxed bg-zinc-50 dark:bg-[#060C20] text-zinc-900 dark:text-zinc-100 focus:outline-none resize-none"
          />
        </div>

        <div className="jarvis-surface overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-blue-500/25">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Sandboxed Live Preview
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Responsive Frame</span>
          </div>
          <iframe
            title="JARVIS Coding Studio Preview"
            sandbox="allow-scripts"
            srcDoc={previewDoc}
            className="w-full h-[255px] bg-white border-0"
          />
          <div className="border-t border-zinc-200 dark:border-blue-500/25 bg-zinc-50 dark:bg-[#060C20]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200/70 dark:border-blue-500/25">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <Terminal className="w-3.5 h-3.5" />
                <span>Live Console ({consoleLogs.length})</span>
              </div>
              <div className="flex items-center gap-3">
                {errorCount > 0 && (
                  <button
                    type="button"
                    onClick={() => runAiCodeAction("debug")}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Fix Errors with JARVIS
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConsoleLogs([])}
                  aria-label="Clear console"
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="h-[92px] overflow-y-auto px-4 py-2 font-mono text-xs space-y-1">
              {consoleLogs.length === 0 ? (
                <p className="text-zinc-400 dark:text-zinc-500">
                  No console logs or runtime errors captured yet.
                </p>
              ) : (
                consoleLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className={
                      entry.level === "error"
                        ? "text-red-600 dark:text-red-400"
                        : entry.level === "warn"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-zinc-700 dark:text-zinc-300"
                    }
                  >
                    <span className="text-zinc-400 mr-2">[{entry.timestamp}]</span>
                    {entry.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
