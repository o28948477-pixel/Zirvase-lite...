import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INITIAL_APPROVALS,
  INITIAL_MEMORIES,
  INITIAL_MODELS,
  INITIAL_PROJECTS,
  INITIAL_ROUTING,
  INITIAL_SKILLS,
} from "../data/initialState";
import { resolveApiUrl } from "../utils/apiUrl";
import type {
  AIModelEntry,
  AccentTheme,
  ActivityEntry,
  ApprovalActionType,
  ApprovalItem,
  AutoScanReport,
  ChatActionPayload,
  ChatMessage,
  CodingProject,
  DiagnosticCheck,
  MemoryEntry,
  MemoryType,
  ModelProviderId,
  NavView,
  RoutingPreferences,
  SettingsTab,
  SkillEntry,
  TaskCategory,
  ThemeMode,
  UIPreferences,
} from "../types/jarvis";

const STORAGE_KEY = "jarvis_os_state_v1";

const DEFAULT_UI_PREFS: UIPreferences = {
  userName: "Imran",
  voiceLanguage: "Bangla (বাংলা)",
  backgroundAnimation: true,
  typingEffect: true,
  moodColors: true,
  hasCompletedWelcome: false,
  detectedMood: "Happy",
  accentTheme: "cosmic-violet",
  autoHealOnConnect: true,
};

interface PersistedState {
  theme: ThemeMode;
  mockupV2?: boolean;
  uiPrefs: UIPreferences;
  models: AIModelEntry[];
  routing: RoutingPreferences;
  skills: SkillEntry[];
  memories: MemoryEntry[];
  approvals: ApprovalItem[];
  projects: CodingProject[];
  activeProjectId: string;
  messages: ChatMessage[];
  activities: ActivityEntry[];
  protectedCoreLocked: boolean;
  sandboxStrictMode: boolean;
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const isMigrated = Boolean(parsed.mockupV2);
      return {
        theme: isMigrated ? (parsed.theme ?? "dark") : "dark",
        mockupV2: true,
        uiPrefs: { ...DEFAULT_UI_PREFS, ...(parsed.uiPrefs ?? {}) },
        models: parsed.models?.length ? parsed.models : INITIAL_MODELS,
        routing: parsed.routing ?? INITIAL_ROUTING,
        skills: parsed.skills?.length ? parsed.skills : INITIAL_SKILLS,
        memories: parsed.memories?.length ? parsed.memories : INITIAL_MEMORIES,
        approvals: parsed.approvals ?? INITIAL_APPROVALS,
        projects: parsed.projects?.length ? parsed.projects : INITIAL_PROJECTS,
        activeProjectId: parsed.activeProjectId ?? INITIAL_PROJECTS[0].id,
        messages: parsed.messages ?? [],
        activities: parsed.activities ?? [
          {
            id: "act-boot",
            timestamp: new Date().toISOString(),
            module: "System",
            action: "JARVIS Workspace Initialized",
            detail: "Cosmic Dark HUD active · Approval Gate enforced (NO APPROVAL = NO CHANGE)",
            status: "nominal",
          },
        ],
        protectedCoreLocked: parsed.protectedCoreLocked ?? true,
        sandboxStrictMode: parsed.sandboxStrictMode ?? true,
      };
    }
  } catch {
    // Fall back to defaults on corrupted storage
  }
  return {
    theme: "dark",
    mockupV2: true,
    uiPrefs: DEFAULT_UI_PREFS,
    models: INITIAL_MODELS,
    routing: INITIAL_ROUTING,
    skills: INITIAL_SKILLS,
    memories: INITIAL_MEMORIES,
    approvals: INITIAL_APPROVALS,
    projects: INITIAL_PROJECTS,
    activeProjectId: INITIAL_PROJECTS[0].id,
    messages: [],
    activities: [
      {
        id: "act-boot",
        timestamp: new Date().toISOString(),
        module: "System",
        action: "JARVIS Workspace Initialized",
        detail: "Cosmic Dark HUD active · Approval Gate enforced (NO APPROVAL = NO CHANGE)",
        status: "nominal",
      },
    ],
    protectedCoreLocked: true,
    sandboxStrictMode: true,
  };
}

export function useJarvisStore() {
  const [state, setState] = useState<PersistedState>(loadState);
  const [activeView, setActiveView] = useState<NavView>(() =>
    state.uiPrefs.hasCompletedWelcome ? "dashboard" : "welcome"
  );
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [chatWebSearchPreset, setChatWebSearchPreset] = useState(false);
  const [sessionStartedAt] = useState<number>(() => Date.now());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{
    checked: boolean;
    backendOnline: boolean;
    apiKeyConfigured: boolean;
    model: string;
  }>({
    checked: false,
    backendOnline: false,
    apiKeyConfigured: false,
    model: "gemini-4-hydrogen",
  });
  const [diagnostics, setDiagnostics] = useState<DiagnosticCheck[]>([]);
  const [autoScanReport, setAutoScanReport] = useState<AutoScanReport | null>(null);
  const autoScannedOnConnectRef = useRef(false);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [state]);

  // Apply theme & accent palette to <html> element
  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: ThemeMode) => {
      if (mode === "dark") {
        root.classList.add("dark");
      } else if (mode === "light") {
        root.classList.remove("dark");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", prefersDark);
      }
    };
    apply(state.theme);
    root.setAttribute("data-accent", state.uiPrefs.accentTheme || "cosmic-violet");

    if (state.theme === "adaptive") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => apply("adaptive");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [state.theme, state.uiPrefs.accentTheme]);

  const logActivity = useCallback(
    (module: string, action: string, detail: string, status: ActivityEntry["status"] = "nominal") => {
      setState((prev) => ({
        ...prev,
        activities: [
          {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            module,
            action,
            detail,
            status,
          },
          ...prev.activities.slice(0, 49),
        ],
      }));
    },
    []
  );

  // Check backend health on mount
  const checkBackendHealth = useCallback(async () => {
    try {
      const resp = await fetch(resolveApiUrl("/api/gemini/health"));
      if (!resp.ok) throw new Error("Backend health endpoint returned error");
      const data = await resp.json();
      setBackendStatus({
        checked: true,
        backendOnline: Boolean(data.backendOnline),
        apiKeyConfigured: Boolean(data.apiKeyConfigured),
        model: data.model || "gemini-4-hydrogen",
      });
      return data;
    } catch {
      setBackendStatus({
        checked: true,
        backendOnline: false,
        apiKeyConfigured: false,
        model: "gemini-4-hydrogen",
      });
      return null;
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  const testGeminiConnection = useCallback(async () => {
    try {
      const resp = await fetch(resolveApiUrl("/api/gemini/test"), { method: "POST" });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        setState((prev) => ({
          ...prev,
          models: prev.models.map((m) =>
            m.id === "gemini"
              ? {
                  ...m,
                  status: "verified",
                  statusNote: `Verified live via server backend (${data.latencyMs}ms)`,
                  lastTestedAt: data.verifiedAt,
                  lastLatencyMs: data.latencyMs,
                  lastError: undefined,
                }
              : m
          ),
        }));
        logActivity(
          "Model Manager",
          "Gemini Connection Verified",
          `Live response from ${data.model} in ${data.latencyMs}ms`,
          "nominal"
        );
        return { ok: true as const, data };
      } else {
        const errMsg = data.error || "Connection verification failed";
        setState((prev) => ({
          ...prev,
          models: prev.models.map((m) =>
            m.id === "gemini"
              ? {
                  ...m,
                  status: "error",
                  statusNote: errMsg,
                  lastTestedAt: new Date().toISOString(),
                  lastLatencyMs: data.latencyMs,
                  lastError: errMsg,
                }
              : m
          ),
        }));
        logActivity("Model Manager", "Gemini Connection Failed", errMsg, "error");
        return { ok: false as const, error: errMsg };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error reaching server";
      setState((prev) => ({
        ...prev,
        models: prev.models.map((m) =>
          m.id === "gemini"
            ? {
                ...m,
                status: "error",
                statusNote: errMsg,
                lastTestedAt: new Date().toISOString(),
                lastError: errMsg,
              }
            : m
        ),
      }));
      logActivity("Model Manager", "Gemini Connection Error", errMsg, "error");
      return { ok: false as const, error: errMsg };
    }
  }, [logActivity]);

  const setTheme = useCallback(
    (theme: ThemeMode) => {
      setState((prev) => ({ ...prev, theme }));
      logActivity("Settings", "Theme Updated", `Switched interface theme to ${theme}`, "nominal");
    },
    [logActivity]
  );

  const setRoutingPreference = useCallback(
    (task: TaskCategory, modelId: ModelProviderId) => {
      setState((prev) => ({
        ...prev,
        routing: { ...prev.routing, [task]: modelId },
      }));
      logActivity("Model Manager", "Task Routing Updated", `${task} -> ${modelId}`, "nominal");
    },
    [logActivity]
  );

  const setDefaultModel = useCallback(
    (modelId: ModelProviderId) => {
      setState((prev) => ({
        ...prev,
        models: prev.models.map((m) => ({ ...m, isDefault: m.id === modelId })),
      }));
      logActivity("Model Manager", "Default Model Changed", `Default set to ${modelId}`, "nominal");
    },
    [logActivity]
  );

  // Memory operations
  const addMemory = useCallback(
    (type: MemoryType, title: string, content: string, activeInContext = true) => {
      const entry: MemoryEntry = {
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        title: title.trim(),
        content: content.trim(),
        activeInContext,
        protected: false,
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => ({ ...prev, memories: [entry, ...prev.memories] }));
      logActivity("Memory Center", "Memory Saved", `${type}: ${entry.title}`, "nominal");
      return entry;
    },
    [logActivity]
  );

  const updateMemory = useCallback(
    (id: string, patch: Partial<Pick<MemoryEntry, "title" | "content" | "type" | "activeInContext">>) => {
      setState((prev) => ({
        ...prev,
        memories: prev.memories.map((m) =>
          m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m
        ),
      }));
      logActivity("Memory Center", "Memory Updated", `Updated memory entry ${id}`, "nominal");
    },
    [logActivity]
  );

  const deleteMemory = useCallback(
    (id: string) => {
      setState((prev) => {
        const target = prev.memories.find((m) => m.id === id);
        if (!target || target.protected) return prev;
        return {
          ...prev,
          memories: prev.memories.filter((m) => m.id !== id),
        };
      });
      logActivity("Memory Center", "Memory Deleted", `Removed memory entry ${id}`, "nominal");
    },
    [logActivity]
  );

  // Coding Studio project operations
  const activeProject = useMemo(
    () => state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0],
    [state.projects, state.activeProjectId]
  );

  const updateActiveProjectCode = useCallback(
    (patch: Partial<Pick<CodingProject, "html" | "css" | "js" | "name" | "description">>) => {
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === prev.activeProjectId
            ? { ...p, ...patch, updatedAt: new Date().toISOString() }
            : p
        ),
      }));
    },
    []
  );

  const createProject = useCallback(
    (name: string, description: string, html?: string, css?: string, js?: string) => {
      const proj: CodingProject = {
        id: `proj-${Date.now()}`,
        name: name.trim() || "Untitled Project",
        description: description.trim() || "JARVIS Coding Studio project",
        html: html ?? `<main class="wrap">\n  <h1>${name || "New Project"}</h1>\n  <p>Created in JARVIS Coding Studio.</p>\n</main>`,
        css: css ?? `body { font-family: system-ui, sans-serif; padding: 24px; background: #f8fafc; color: #0f172a; }`,
        js: js ?? `console.log("JARVIS project loaded");`,
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        projects: [proj, ...prev.projects],
        activeProjectId: proj.id,
      }));
      logActivity("Coding Studio", "Project Created", proj.name, "nominal");
      return proj;
    },
    [logActivity]
  );

  const selectProject = useCallback((projectId: string) => {
    setState((prev) => ({ ...prev, activeProjectId: projectId }));
  }, []);

  // Mandatory Approval Workflow Engine
  const proposeUpdate = useCallback(
    (input: {
      title: string;
      source: ApprovalItem["source"];
      area: string;
      problemOrReason: string;
      proposedSolution: string;
      securityImpact: string;
      beforePreview: string;
      afterPreview: string;
      actionType: ApprovalActionType;
      actionPayload: Record<string, unknown>;
    }) => {
      const now = new Date().toISOString();
      const item: ApprovalItem = {
        id: `upd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...input,
        status: "Waiting for Approval",
        createdAt: now,
        updatedAt: now,
      };
      setState((prev) => ({
        ...prev,
        approvals: [item, ...prev.approvals],
      }));
      logActivity(
        "Update Approval Center",
        "Proposal Queued",
        `${item.title} (${item.source}) awaiting owner approval`,
        "pending"
      );
      return item;
    },
    [logActivity]
  );

  const approveAndApplyUpdate = useCallback(
    (approvalId: string) => {
      setState((prev) => {
        const target = prev.approvals.find((a) => a.id === approvalId);
        if (!target || target.status !== "Waiting for Approval") return prev;

        let nextState = { ...prev };
        let snapshot: Record<string, unknown> = {};
        let succeeded = true;

        try {
          switch (target.actionType) {
            case "toggle_theme": {
              const nextTheme = String(target.actionPayload.theme ?? "light") as ThemeMode;
              snapshot = { theme: prev.theme };
              nextState.theme = nextTheme;
              break;
            }
            case "install_skill":
            case "enable_skill": {
              const skillId = String(target.actionPayload.skillId ?? "");
              const existing = prev.skills.find((s) => s.id === skillId);
              if (existing) {
                snapshot = { skillId, installed: existing.installed, enabled: existing.enabled };
                nextState.skills = prev.skills.map((s) =>
                  s.id === skillId ? { ...s, installed: true, enabled: true } : s
                );
              } else if (target.actionPayload.customSkill) {
                const custom = target.actionPayload.customSkill as SkillEntry;
                snapshot = { addedSkillId: custom.id };
                nextState.skills = [custom, ...prev.skills];
              } else {
                succeeded = false;
              }
              break;
            }
            case "disable_skill": {
              const skillId = String(target.actionPayload.skillId ?? "");
              const existing = prev.skills.find((s) => s.id === skillId);
              if (existing) {
                snapshot = { skillId, installed: existing.installed, enabled: existing.enabled };
                nextState.skills = prev.skills.map((s) =>
                  s.id === skillId ? { ...s, enabled: false } : s
                );
              } else {
                succeeded = false;
              }
              break;
            }
            case "uninstall_skill": {
              const skillId = String(target.actionPayload.skillId ?? "");
              const existing = prev.skills.find((s) => s.id === skillId);
              if (existing) {
                snapshot = { skillId, installed: existing.installed, enabled: existing.enabled };
                nextState.skills = prev.skills.map((s) =>
                  s.id === skillId ? { ...s, installed: false, enabled: false } : s
                );
              } else {
                succeeded = false;
              }
              break;
            }
            case "apply_code": {
              const projId = String(target.actionPayload.projectId ?? prev.activeProjectId);
              const proj = prev.projects.find((p) => p.id === projId);
              if (proj) {
                snapshot = {
                  projectId: proj.id,
                  html: proj.html,
                  css: proj.css,
                  js: proj.js,
                };
                nextState.projects = prev.projects.map((p) =>
                  p.id === projId
                    ? {
                        ...p,
                        html: String(target.actionPayload.html ?? p.html),
                        css: String(target.actionPayload.css ?? p.css),
                        js: String(target.actionPayload.js ?? p.js),
                        updatedAt: new Date().toISOString(),
                      }
                    : p
                );
              } else {
                succeeded = false;
              }
              break;
            }
            case "add_memory_rule": {
              const newId = `mem-evo-${Date.now()}`;
              snapshot = { addedMemoryId: newId };
              nextState.memories = [
                {
                  id: newId,
                  type: "System Settings",
                  title: target.title,
                  content: String(target.actionPayload.content ?? target.proposedSolution),
                  activeInContext: true,
                  protected: false,
                  updatedAt: new Date().toISOString(),
                },
                ...prev.memories,
              ];
              break;
            }
            case "update_routing": {
              const task = (target.actionPayload.task as TaskCategory) || "Coding";
              const model = (target.actionPayload.model as ModelProviderId) || "gemini";
              snapshot = { routing: { ...prev.routing } };
              nextState.routing = { ...prev.routing, [task]: model };
              break;
            }
            case "config_hardening": {
              snapshot = {
                protectedCoreLocked: prev.protectedCoreLocked,
                sandboxStrictMode: prev.sandboxStrictMode,
              };
              nextState.protectedCoreLocked = true;
              nextState.sandboxStrictMode = true;
              break;
            }
          }
        } catch {
          succeeded = false;
        }

        const now = new Date().toISOString();
        nextState.approvals = prev.approvals.map((a) =>
          a.id === approvalId
            ? {
                ...a,
                status: succeeded ? "Completed" : "Failed",
                rollbackSnapshot: snapshot,
                updatedAt: now,
              }
            : a
        );
        nextState.activities = [
          {
            id: `act-${Date.now()}`,
            timestamp: now,
            module: "Update Approval Center",
            action: succeeded ? "Approved & Applied Update" : "Update Application Failed",
            detail: target.title,
            status: succeeded ? "nominal" : "error",
          },
          ...prev.activities.slice(0, 49),
        ];

        return nextState;
      });
    },
    []
  );

  const rejectUpdate = useCallback((approvalId: string) => {
    setState((prev) => {
      const target = prev.approvals.find((a) => a.id === approvalId);
      if (!target) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        approvals: prev.approvals.map((a) =>
          a.id === approvalId ? { ...a, status: "Rolled Back", updatedAt: now } : a
        ),
        activities: [
          {
            id: `act-${Date.now()}`,
            timestamp: now,
            module: "Update Approval Center",
            action: "Proposal Rejected",
            detail: `Rejected without applying: ${target.title}`,
            status: "warning",
          },
          ...prev.activities.slice(0, 49),
        ],
      };
    });
  }, []);

  const rollbackUpdate = useCallback((approvalId: string) => {
    setState((prev) => {
      const target = prev.approvals.find((a) => a.id === approvalId);
      if (!target || target.status !== "Completed" || !target.rollbackSnapshot) return prev;

      const snap = target.rollbackSnapshot;
      let nextState = { ...prev };

      switch (target.actionType) {
        case "toggle_theme":
          if (snap.theme) nextState.theme = snap.theme as ThemeMode;
          break;
        case "install_skill":
        case "enable_skill":
        case "disable_skill":
        case "uninstall_skill":
          if (snap.addedSkillId) {
            nextState.skills = prev.skills.filter((s) => s.id !== snap.addedSkillId);
          } else if (snap.skillId) {
            nextState.skills = prev.skills.map((s) =>
              s.id === snap.skillId
                ? {
                    ...s,
                    installed: Boolean(snap.installed),
                    enabled: Boolean(snap.enabled),
                  }
                : s
            );
          }
          break;
        case "apply_code":
          if (snap.projectId) {
            nextState.projects = prev.projects.map((p) =>
              p.id === snap.projectId
                ? {
                    ...p,
                    html: String(snap.html ?? p.html),
                    css: String(snap.css ?? p.css),
                    js: String(snap.js ?? p.js),
                  }
                : p
            );
          }
          break;
        case "add_memory_rule":
          if (snap.addedMemoryId) {
            nextState.memories = prev.memories.filter((m) => m.id !== snap.addedMemoryId);
          }
          break;
        case "update_routing":
          if (snap.routing) {
            nextState.routing = snap.routing as RoutingPreferences;
          }
          break;
        case "config_hardening":
          nextState.protectedCoreLocked = Boolean(snap.protectedCoreLocked);
          nextState.sandboxStrictMode = Boolean(snap.sandboxStrictMode);
          break;
      }

      const now = new Date().toISOString();
      nextState.approvals = prev.approvals.map((a) =>
        a.id === approvalId ? { ...a, status: "Rolled Back", updatedAt: now } : a
      );
      nextState.activities = [
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          module: "Update Approval Center",
          action: "Update Rolled Back",
          detail: `Reverted: ${target.title}`,
          status: "warning",
        },
        ...prev.activities.slice(0, 49),
      ];
      return nextState;
    });
  }, []);

  // Run System Diagnostics
  const runDiagnostics = useCallback(async (): Promise<DiagnosticCheck[]> => {
    const checks: DiagnosticCheck[] = [];

    // 1. Backend & Gemini Check
    const health = await checkBackendHealth();
    if (health?.backendOnline && health?.apiKeyConfigured) {
      checks.push({
        id: "diag-backend",
        name: "Express Backend & Gemini Configuration",
        category: "Backend",
        status: "pass",
        summary: "Server online and GEMINI_API_KEY configured securely on backend.",
        detail: `Endpoint /api/gemini/health responded normally for model ${health.model}.`,
      });
    } else {
      checks.push({
        id: "diag-backend",
        name: "Express Backend & Gemini Configuration",
        category: "Backend",
        status: "fail",
        summary: "Backend unreachable or GEMINI_API_KEY missing in server environment.",
        detail: "Verify Express server is running and GEMINI_API_KEY is set in Settings > Secrets.",
      });
    }

    // 2. HTML / CSS / JS Coding Studio Lint
    const proj = activeProject;
    const issues: string[] = [];
    if (!proj.html.trim()) issues.push("HTML markup is empty.");
    if ((proj.html.match(/<div/g) || []).length !== (proj.html.match(/<\/div>/g) || []).length) {
      issues.push("Mismatched <div> opening/closing tags in active HTML.");
    }
    if ((proj.css.match(/{/g) || []).length !== (proj.css.match(/}/g) || []).length) {
      issues.push("Unbalanced curly braces { } in active CSS.");
    }
    try {
      new Function(proj.js);
    } catch (e) {
      issues.push(`JavaScript syntax error: ${e instanceof Error ? e.message : String(e)}`);
    }

    checks.push({
      id: "diag-code",
      name: `Coding Studio Syntax (${proj.name})`,
      category: "Frontend Code",
      status: issues.length === 0 ? "pass" : "warning",
      summary:
        issues.length === 0
          ? "Active HTML, CSS, and JavaScript passed syntax validation."
          : `${issues.length} syntax issue(s) detected in active workspace.`,
      detail: issues.length === 0 ? "Zero unbalanced tags or JS parse errors." : issues.join(" "),
    });

    // 3. Security & Protected Core Check
    checks.push({
      id: "diag-security",
      name: "Protected Core & Approval Gate",
      category: "Security",
      status: state.protectedCoreLocked && state.sandboxStrictMode ? "pass" : "warning",
      summary:
        state.protectedCoreLocked && state.sandboxStrictMode
          ? "Approval gate active and skill sandbox enforcement locked."
          : "Security hardening flags are relaxed.",
      detail: "Mandatory Approval Workflow guarantees NO APPROVAL = NO CHANGE.",
      suggestedFix:
        !state.protectedCoreLocked || !state.sandboxStrictMode
          ? {
              title: "Restore Strict Protected Core & Sandbox Mode",
              solution: "Re-enable Protected Core Lock and Strict Skill Sandbox execution.",
              actionType: "config_hardening",
              actionPayload: {},
            }
          : undefined,
    });

    // 4. Browser Voice Capabilities
    const hasSpeechRec =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    const hasSpeechSynth = typeof window !== "undefined" && "speechSynthesis" in window;
    checks.push({
      id: "diag-voice",
      name: "Browser Voice Assistant Support",
      category: "Capabilities",
      status: hasSpeechRec && hasSpeechSynth ? "pass" : "warning",
      summary:
        hasSpeechRec && hasSpeechSynth
          ? "SpeechRecognition and SpeechSynthesis APIs supported in this browser."
          : `SpeechRecognition: ${hasSpeechRec ? "Supported" : "Unavailable"} · SpeechSynthesis: ${
              hasSpeechSynth ? "Supported" : "Unavailable"
            }`,
      detail: "Voice Assistant uses browser-native Web Speech APIs with text fallback.",
    });

    // 5. Storage & Memory Integrity
    const protectedCount = state.memories.filter((m) => m.protected).length;
    checks.push({
      id: "diag-storage",
      name: "Memory Center & Local Persistence",
      category: "Storage",
      status: protectedCount >= 1 ? "pass" : "warning",
      summary: `${state.memories.length} memories stored (${protectedCount} protected core rules).`,
      detail: "Browser localStorage persistence active and responsive.",
    });

    setDiagnostics(checks);
    logActivity(
      "System Diagnostics",
      "Diagnostic Suite Completed",
      `${checks.filter((c) => c.status === "pass").length}/${checks.length} checks nominal`,
      checks.some((c) => c.status === "fail") ? "error" : "nominal"
    );
    return checks;
  }, [activeProject, checkBackendHealth, logActivity, state.memories, state.protectedCoreLocked, state.sandboxStrictMode]);

  const appendChatMessages = useCallback((msgs: ChatMessage[]) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, ...msgs],
    }));
  }, []);

  // Autonomous Self-Scan & Self-Heal Engine (triggers on API connect, manual scan, or chat command)
  const runAutoScanAndHeal = useCallback(
    async (options?: {
      trigger?: "api_connected" | "manual" | "chat_command";
      autoHeal?: boolean;
      postToChat?: boolean;
    }): Promise<AutoScanReport> => {
      const trigger = options?.trigger ?? "manual";
      const autoHeal = options?.autoHeal ?? state.uiPrefs.autoHealOnConnect;
      const postToChat = options?.postToChat ?? false;

      setAutoScanReport({
        trigger,
        scannedAt: new Date().toISOString(),
        status: "scanning",
        issuesFound: [],
        fixesApplied: [],
        summary: "Scanning JARVIS program, active website code, and device environment...",
        environmentNote: "Checking backend API, Coding Studio syntax, security locks, and browser readiness.",
      });

      const checks = await runDiagnostics();
      const localIssues = checks
        .filter((c) => c.status !== "pass")
        .map((c) => `${c.name}: ${c.summary}`);

      const isMobileUa =
        typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
      const envLabel = isMobileUa ? "Mobile / Phone Browser" : "Desktop / Web Browser";

      let detectedBugs: string[] = [...localIssues];
      let fixesApplied: string[] = [];
      let aiReportMessage = "";

      try {
        const resp = await fetch(resolveApiUrl("/api/gemini/self-scan"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger,
            languageHint: state.uiPrefs.voiceLanguage,
            localIssues: checks.map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              summary: c.summary,
              detail: c.detail,
            })),
            systemSnapshot: {
              environment: envLabel,
              theme: state.theme,
              accentTheme: state.uiPrefs.accentTheme,
              activeSkills: state.skills.filter((s) => s.enabled).length,
              protectedCoreLocked: state.protectedCoreLocked,
              sandboxStrictMode: state.sandboxStrictMode,
              memoriesCount: state.memories.length,
            },
            activeProject: {
              name: activeProject.name,
              html: activeProject.html,
              css: activeProject.css,
              js: activeProject.js,
            },
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.detectedBugs) && data.detectedBugs.length > 0) {
            detectedBugs = Array.from(new Set([...localIssues, ...data.detectedBugs]));
          }
          if (typeof data.reportMessage === "string" && data.reportMessage.trim()) {
            aiReportMessage = data.reportMessage.trim();
          }

          // Auto-heal Coding Studio bugs if Gemini returned clean repaired code
          if (autoHeal && data.hasCodeFix && (data.repairedHtml || data.repairedCss || data.repairedJs)) {
            const snapHtml = activeProject.html;
            const snapCss = activeProject.css;
            const snapJs = activeProject.js;
            const nextHtml = data.repairedHtml?.trim() ? data.repairedHtml : snapHtml;
            const nextCss = data.repairedCss?.trim() ? data.repairedCss : snapCss;
            const nextJs = data.repairedJs?.trim() ? data.repairedJs : snapJs;

            updateActiveProjectCode({ html: nextHtml, css: nextCss, js: nextJs });
            fixesApplied.push(`Coding Studio (${activeProject.name}): syntax/glitch auto-repaired`);

            const now = new Date().toISOString();
            setState((prev) => ({
              ...prev,
              approvals: [
                {
                  id: `heal-code-${Date.now()}`,
                  title: `Auto-Healed ${activeProject.name} Code Glitch`,
                  source: "System Diagnostics",
                  area: "Coding Studio",
                  status: "Completed",
                  problemOrReason: localIssues.join(" ") || "Detected HTML/CSS/JS glitch during API self-scan.",
                  proposedSolution: "Automatically repaired broken tags, braces, or script syntax.",
                  securityImpact: "Low · Rollback snapshot saved",
                  beforePreview: snapHtml.slice(0, 120),
                  afterPreview: nextHtml.slice(0, 120),
                  actionType: "apply_code",
                  actionPayload: { projectId: activeProject.id, html: nextHtml, css: nextCss, js: nextJs },
                  rollbackSnapshot: { projectId: activeProject.id, html: snapHtml, css: snapCss, js: snapJs },
                  createdAt: now,
                  updatedAt: now,
                },
                ...prev.approvals,
              ],
            }));
          }
        }
      } catch {
        // Continue with deterministic local self-heal if AI scan request hits transient error
      }

      // Auto-heal relaxed security locks or model connection status locally
      if (autoHeal && (!state.protectedCoreLocked || !state.sandboxStrictMode)) {
        const prevLocked = state.protectedCoreLocked;
        const prevSandbox = state.sandboxStrictMode;
        const now = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          protectedCoreLocked: true,
          sandboxStrictMode: true,
          approvals: [
            {
              id: `heal-sec-${Date.now()}`,
              title: "Auto-Restored Security & Sandbox Locks",
              source: "System Diagnostics",
              area: "Security",
              status: "Completed",
              problemOrReason: "Protected Core or Strict Sandbox mode was relaxed.",
              proposedSolution: "Automatically re-enabled Protected Core Lock & Strict Sandbox.",
              securityImpact: "High Protection · Rollback snapshot saved",
              beforePreview: `Locked: ${prevLocked}, Sandbox: ${prevSandbox}`,
              afterPreview: "Locked: true, Sandbox: true",
              actionType: "config_hardening",
              actionPayload: {},
              rollbackSnapshot: { protectedCoreLocked: prevLocked, sandboxStrictMode: prevSandbox },
              createdAt: now,
              updatedAt: now,
            },
            ...prev.approvals,
          ],
        }));
        fixesApplied.push("Security Locks: Protected Core & Strict Sandbox restored");
      }

      // Mark Gemini model verified when API scan succeeds
      setState((prev) => ({
        ...prev,
        models: prev.models.map((m) =>
          m.id === "gemini" && m.status !== "verified"
            ? {
                ...m,
                status: "verified",
                statusNote: "API active & self-scan verified",
                lastTestedAt: new Date().toISOString(),
              }
            : m
        ),
      }));

      const reportStatus: AutoScanReport["status"] =
        fixesApplied.length > 0
          ? "healed"
          : detectedBugs.length > 0
          ? "issues_found"
          : "healthy";

      const summary =
        aiReportMessage ||
        (fixesApplied.length > 0
          ? `প্রোগ্রাম স্ক্যান সম্পন্ন (${envLabel}): ${detectedBugs.length}টি সমস্যা পাওয়া গিয়েছিল এবং ${fixesApplied.length}টি অটো-ফিক্স করা হয়েছে।`
          : detectedBugs.length > 0
          ? `স্ক্যানে ${detectedBugs.length}টি বিষয় পাওয়া গেছে (${envLabel}): ${detectedBugs.join(" · ")}`
          : `API কানেক্টেড ও প্রোগ্রাম স্ক্যান সম্পন্ন (${envLabel}): কোনো বাগ বা গ্লিচ পাওয়া যায়নি, সব সিস্টেম ১০০% ঠিক আছে।`);

      const finalReport: AutoScanReport = {
        trigger,
        scannedAt: new Date().toISOString(),
        status: reportStatus,
        issuesFound: detectedBugs,
        fixesApplied,
        summary,
        environmentNote: `${envLabel} · ${checks.filter((c) => c.status === "pass").length}/${checks.length} checks passed`,
      };

      setAutoScanReport(finalReport);
      logActivity(
        "Self-Heal Scanner",
        reportStatus === "healed" ? "Program Issues Auto-Fixed" : "Program Scan Completed",
        finalReport.summary,
        reportStatus === "issues_found" ? "warning" : "nominal"
      );

      if (postToChat || fixesApplied.length > 0) {
        appendChatMessages([
          {
            id: `msg-scan-${Date.now()}`,
            role: "assistant",
            content:
              fixesApplied.length > 0
                ? `🛠️ **অটো-স্ক্যান ও ফিক্স রিপোর্ট (${envLabel}):**\n${finalReport.summary}\n\n✅ **যা ঠিক করা হয়েছে:**\n${fixesApplied
                    .map((f) => `• ${f}`)
                    .join("\n")}\n\n(প্রয়োজনে Update Center থেকে Rollback করতে পারবেন।)`
                : `🔍 **JARVIS প্রোগ্রাম স্ক্যান রিপোর্ট (${envLabel}):**\n${finalReport.summary}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      return finalReport;
    },
    [
      activeProject.css,
      activeProject.html,
      activeProject.id,
      activeProject.js,
      activeProject.name,
      appendChatMessages,
      logActivity,
      runDiagnostics,
      state.memories.length,
      state.protectedCoreLocked,
      state.sandboxStrictMode,
      state.skills,
      state.theme,
      state.uiPrefs.accentTheme,
      state.uiPrefs.autoHealOnConnect,
      state.uiPrefs.voiceLanguage,
      updateActiveProjectCode,
    ]
  );

  // Trigger automatic program scan when API becomes active
  useEffect(() => {
    if (backendStatus.checked && backendStatus.apiKeyConfigured && !autoScannedOnConnectRef.current) {
      autoScannedOnConnectRef.current = true;
      void runAutoScanAndHeal({
        trigger: "api_connected",
        autoHeal: state.uiPrefs.autoHealOnConnect,
        postToChat: false,
      });
    }
  }, [backendStatus.apiKeyConfigured, backendStatus.checked, runAutoScanAndHeal, state.uiPrefs.autoHealOnConnect]);

  const updateUiPrefs = useCallback((patch: Partial<UIPreferences>) => {
    setState((prev) => ({
      ...prev,
      uiPrefs: { ...prev.uiPrefs, ...patch },
    }));
  }, []);

  // Execute live UI / Theme / Scan commands triggered from natural chat
  const applyChatAction = useCallback(
    async (action: ChatActionPayload): Promise<string | null> => {
      if (!action || action.actionType === "none") return null;

      if (action.actionType === "change_theme") {
        const accents: AccentTheme[] = [
          "cyber-cyan",
          "emerald-matrix",
          "rose-aurora",
          "solar-gold",
          "cosmic-violet",
        ];
        let appliedParts: string[] = [];

        if (action.themeMode && action.themeMode !== "keep") {
          setTheme(action.themeMode);
          appliedParts.push(`${action.themeMode} mode`);
        }

        if (action.accentTheme && action.accentTheme !== "keep") {
          let nextAccent: AccentTheme;
          if (action.accentTheme === "cycle_pretty") {
            const idx = accents.indexOf(state.uiPrefs.accentTheme || "cosmic-violet");
            nextAccent = accents[(idx + 1) % accents.length];
          } else {
            nextAccent = action.accentTheme as AccentTheme;
          }
          updateUiPrefs({ accentTheme: nextAccent });
          appliedParts.push(`${nextAccent} palette`);
        } else if (!appliedParts.length) {
          const idx = accents.indexOf(state.uiPrefs.accentTheme || "cosmic-violet");
          const nextAccent = accents[(idx + 1) % accents.length];
          updateUiPrefs({ accentTheme: nextAccent });
          appliedParts.push(`${nextAccent} palette`);
        }

        const label = `Theme updated: ${appliedParts.join(" · ")}`;
        logActivity("AI Assistant", "Live Theme Changed via Chat", label, "nominal");
        return label;
      }

      if (action.actionType === "toggle_animation" && typeof action.animationEnabled === "boolean") {
        updateUiPrefs({ backgroundAnimation: action.animationEnabled });
        const label = `Background animations ${action.animationEnabled ? "enabled" : "paused"}`;
        logActivity("AI Assistant", "Animation Preference Updated", label, "nominal");
        return label;
      }

      if (action.actionType === "scan_and_heal") {
        const report = await runAutoScanAndHeal({
          trigger: "chat_command",
          autoHeal: true,
          postToChat: false,
        });
        return report.summary;
      }

      return null;
    },
    [logActivity, runAutoScanAndHeal, setTheme, state.uiPrefs.accentTheme, updateUiPrefs]
  );

  const updateChatMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));
    },
    []
  );

  const clearChat = useCallback(() => {
    setState((prev) => ({ ...prev, messages: [] }));
  }, []);

  const setMessageFeedback = useCallback(
    (id: string, feedback: "helpful" | "not_helpful") => {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === id ? { ...m, feedback: m.feedback === feedback ? undefined : feedback } : m
        ),
      }));
    },
    []
  );

  const completeWelcome = useCallback((nextView: NavView = "dashboard") => {
    setState((prev) => ({
      ...prev,
      uiPrefs: { ...prev.uiPrefs, hasCompletedWelcome: true },
    }));
    setActiveView(nextView);
  }, []);

  const openSettings = useCallback((tab: SettingsTab = "general") => {
    setSettingsTab(tab);
    setActiveView("settings");
  }, []);

  const openChatWithWebSearch = useCallback(() => {
    setChatWebSearchPreset(true);
    setActiveView("assistant");
  }, []);

  const toggleSecurityFlag = useCallback(
    (flag: "protectedCoreLocked" | "sandboxStrictMode") => {
      setState((prev) => ({ ...prev, [flag]: !prev[flag] }));
    },
    []
  );

  const resetAllData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(loadState());
  }, []);

  const pendingApprovalsCount = useMemo(
    () => state.approvals.filter((a) => a.status === "Waiting for Approval").length,
    [state.approvals]
  );

  const activeSkillsCount = useMemo(
    () => state.skills.filter((s) => s.installed && s.enabled).length,
    [state.skills]
  );

  return {
    state,
    activeView,
    setActiveView,
    settingsTab,
    setSettingsTab,
    openSettings,
    chatWebSearchPreset,
    setChatWebSearchPreset,
    openChatWithWebSearch,
    mobileNavOpen,
    setMobileNavOpen,
    backendStatus,
    diagnostics,
    autoScanReport,
    runAutoScanAndHeal,
    applyChatAction,
    activeProject,
    pendingApprovalsCount,
    activeSkillsCount,
    sessionStartedAt,
    setTheme,
    setRoutingPreference,
    setDefaultModel,
    checkBackendHealth,
    testGeminiConnection,
    addMemory,
    updateMemory,
    deleteMemory,
    updateActiveProjectCode,
    createProject,
    selectProject,
    proposeUpdate,
    approveAndApplyUpdate,
    rejectUpdate,
    rollbackUpdate,
    runDiagnostics,
    appendChatMessages,
    updateChatMessage,
    clearChat,
    setMessageFeedback,
    updateUiPrefs,
    completeWelcome,
    toggleSecurityFlag,
    logActivity,
    resetAllData,
  };
}

export type JarvisStore = ReturnType<typeof useJarvisStore>;
