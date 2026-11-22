import type {
  AIModelEntry,
  ApprovalItem,
  CodingProject,
  MemoryEntry,
  RoutingPreferences,
  SkillEntry,
} from "../types/jarvis";

export const INITIAL_MODELS: AIModelEntry[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    modelSlug: "gemini-4-hydrogen",
    provider: "Google AI (Server Backend)",
    status: "configured_untested",
    statusNote: "Served securely via /api/gemini/* Express backend",
    strengths: ["General Reasoning", "Structured Routing", "Code Generation", "Multilingual (BN/EN)"],
    isDefault: true,
  },
  {
    id: "chatgpt",
    name: "ChatGPT (OpenAI)",
    modelSlug: "gpt-4o (Planned)",
    provider: "OpenAI API",
    status: "not_connected",
    statusNote: "Not connected. Requires dedicated OpenAI backend proxy integration.",
    strengths: ["General Assistant", "Writing", "Tool Orchestration"],
    isDefault: false,
  },
  {
    id: "claude",
    name: "Claude",
    modelSlug: "claude-sonnet (Planned)",
    provider: "Anthropic API",
    status: "not_connected",
    statusNote: "Not connected. Requires dedicated Anthropic backend proxy integration.",
    strengths: ["Long-Context Coding", "Architecture Review", "Writing"],
    isDefault: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    modelSlug: "deepseek-reasoner (Planned)",
    provider: "DeepSeek API",
    status: "not_connected",
    statusNote: "Not connected. Requires dedicated DeepSeek backend proxy integration.",
    strengths: ["Algorithmic Coding", "Math & Logic", "Debugging"],
    isDefault: false,
  },
];

export const INITIAL_ROUTING: RoutingPreferences = {
  Coding: "gemini",
  "Web Development": "gemini",
  Research: "gemini",
  Writing: "gemini",
  Diagnostics: "gemini",
  General: "gemini",
};

export const INITIAL_SKILLS: SkillEntry[] = [
  {
    id: "coding",
    name: "Coding Skill",
    category: "Engineering",
    description: "Generates, explains, debugs, and refactors clean JavaScript, TypeScript, and HTML modules.",
    source: "JARVIS Skill Store",
    version: "1.0.0",
    installed: true,
    enabled: true,
    permissions: ["read:workspace_code", "propose:code_diff"],
    sandboxed: true,
  },
  {
    id: "web-dev",
    name: "Web Development Skill",
    category: "Engineering",
    description: "Builds responsive mobile-first web layouts compatible with Acode and GitHub Pages.",
    source: "JARVIS Skill Store",
    version: "1.0.0",
    installed: true,
    enabled: true,
    permissions: ["read:workspace_code", "preview:iframe", "propose:code_diff"],
    sandboxed: true,
  },
  {
    id: "research",
    name: "Research Skill",
    category: "Intelligence",
    description: "Analyzes technical topics, compares architectures, and synthesizes structured briefs.",
    source: "JARVIS Skill Store",
    version: "1.0.0",
    installed: true,
    enabled: true,
    permissions: ["read:memory"],
    sandboxed: true,
  },
  {
    id: "writing",
    name: "Writing Skill",
    category: "Productivity",
    description: "Drafts clear technical documentation, project plans, and bilingual Bengali/English copy.",
    source: "JARVIS Skill Store",
    version: "1.0.0",
    installed: true,
    enabled: true,
    permissions: ["read:memory"],
    sandboxed: true,
  },
  {
    id: "github",
    name: "GitHub Skill",
    category: "DevOps",
    description: "Inspects public GitHub repositories and prepares repository structures for GitHub Pages.",
    source: "GitHub",
    version: "0.9.0",
    installed: true,
    enabled: true,
    permissions: ["network:github_public_read"],
    sandboxed: true,
  },
  {
    id: "browser",
    name: "Browser Skill",
    category: "Automation",
    description: "Manages sandboxed iframe previews and browser capability detection.",
    source: "JARVIS Skill Store",
    version: "0.8.0",
    installed: false,
    enabled: false,
    permissions: ["preview:iframe"],
    sandboxed: true,
  },
  {
    id: "file-management",
    name: "File Management Skill",
    category: "Workspace",
    description: "Organizes Coding Studio projects, local backups, and single-file HTML exports.",
    source: "JARVIS Skill Store",
    version: "1.0.0",
    installed: true,
    enabled: true,
    permissions: ["storage:local_projects", "export:html"],
    sandboxed: true,
  },
  {
    id: "automation",
    name: "Automation Skill",
    category: "Automation",
    description: "Chains multi-step Brain plans into approval-gated system workflows.",
    source: "JARVIS Skill Store",
    version: "0.7.0",
    installed: false,
    enabled: false,
    permissions: ["propose:workflow"],
    sandboxed: true,
  },
  {
    id: "image-gen",
    name: "Image Generation Skill",
    category: "Creative",
    description: "Planned capability for generating visual assets once paid image model routing is enabled.",
    source: "JARVIS Skill Store",
    version: "0.5.0",
    installed: false,
    enabled: false,
    permissions: ["media:generate"],
    sandboxed: true,
  },
  {
    id: "voice-assistant",
    name: "Voice Assistant Skill",
    category: "Interface",
    description: "Connects browser SpeechRecognition and SpeechSynthesis to the JARVIS AI Brain.",
    source: "JARVIS Skill Store",
    version: "1.0.0",
    installed: true,
    enabled: true,
    permissions: ["audio:microphone", "audio:speech_synthesis"],
    sandboxed: true,
  },
  {
    id: "memory",
    name: "Memory Skill",
    category: "Intelligence",
    description: "Retrieves and updates structured user preferences, project memory, and rules.",
    source: "JARVIS Skill Store",
    version: "1.0.0",
    installed: true,
    enabled: true,
    permissions: ["storage:memory_read", "storage:memory_write"],
    sandboxed: true,
  },
  {
    id: "data-analysis",
    name: "Data Analysis Skill",
    category: "Intelligence",
    description: "Parses JSON/CSV payloads and summarizes diagnostic telemetry.",
    source: "JARVIS Skill Store",
    version: "0.9.0",
    installed: false,
    enabled: false,
    permissions: ["read:diagnostics"],
    sandboxed: true,
  },
  {
    id: "translation",
    name: "Translation Skill",
    category: "Productivity",
    description: "Translates seamlessly across English, Bengali, and Banglish technical terminology.",
    source: "JARVIS Skill Store",
    version: "1.0.0",
    installed: true,
    enabled: true,
    permissions: ["read:conversation"],
    sandboxed: true,
  },
  {
    id: "document-creation",
    name: "Document Creation Skill",
    category: "Productivity",
    description: "Prepares structured markdown specs, changelogs, and architecture blueprints.",
    source: "JARVIS Skill Store",
    version: "0.9.0",
    installed: false,
    enabled: false,
    permissions: ["export:document"],
    sandboxed: true,
  },
];

export const INITIAL_MEMORIES: MemoryEntry[] = [
  {
    id: "mem-rule-approval",
    type: "Important Instructions",
    title: "Mandatory Owner Approval Rule",
    content:
      "NO APPROVAL = NO CHANGE. JARVIS may analyze, diagnose, and prepare diffs, but must never apply system, UI, skill, or code updates without explicit owner approval.",
    activeInContext: true,
    protected: true,
    updatedAt: "2026-11-20T09:00:00Z",
  },
  {
    id: "mem-pref-ui",
    type: "User Preferences",
    title: "Theme & Mobile Workflow Preference",
    content:
      "Default to Premium Light UI with adaptive dark mode support. Keep layouts mobile-friendly for Android management, Acode editing, and GitHub Pages single-file export.",
    activeInContext: true,
    protected: false,
    updatedAt: "2026-11-20T09:00:00Z",
  },
  {
    id: "mem-proj-blueprint",
    type: "Project Memory",
    title: "JARVIS Master Blueprint V1.0",
    content:
      "Personal AI Operating System combining Central AI Brain, Multi-AI Network, 14-skill plugin architecture, Coding Studio, Memory Center, Voice Assistant, Diagnostics, Self-Evolution, and Update Approval Center.",
    activeInContext: true,
    protected: false,
    updatedAt: "2026-11-20T09:00:00Z",
  },
  {
    id: "mem-sec-honesty",
    type: "System Settings",
    title: "Verification Honesty Standard",
    content:
      "Never mark external AI models (ChatGPT, Claude, DeepSeek) or GitHub OAuth as connected until real API verification succeeds.",
    activeInContext: true,
    protected: true,
    updatedAt: "2026-11-20T09:00:00Z",
  },
];

export const INITIAL_PROJECTS: CodingProject[] = [
  {
    id: "proj-starter-portal",
    name: "JARVIS Portable Landing Starter",
    description: "Mobile-responsive single-file compatible web starter for Acode & GitHub Pages.",
    html: `<main class="card">
  <p class="kicker">Personal Web Workspace</p>
  <h1>JARVIS Portable Starter</h1>
  <p class="lead">Edit this layout directly in Coding Studio or export it as a single self-contained HTML file for Acode and GitHub Pages.</p>
  <div class="actions">
    <button id="counterBtn" class="btn">Test Interaction (<span id="count">0</span>)</button>
  </div>
</main>`,
    css: `* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: system-ui, -apple-system, sans-serif;
  background: #f8fafc;
  color: #0f172a;
}
.card {
  width: 100%;
  max-width: 560px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 32px;
}
.kicker {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
}
h1 {
  margin: 0 0 12px;
  font-size: 28px;
  line-height: 1.2;
}
.lead {
  margin: 0 0 24px;
  color: #475569;
  line-height: 1.6;
}
.btn {
  border: 0;
  border-radius: 10px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 600;
  background: #2563eb;
  color: #ffffff;
  cursor: pointer;
}
.btn:hover { background: #1d4ed8; }`,
    js: `const btn = document.getElementById("counterBtn");
const countEl = document.getElementById("count");
let count = 0;
if (btn && countEl) {
  btn.addEventListener("click", () => {
    count += 1;
    countEl.textContent = String(count);
  });
}`,
    updatedAt: "2026-11-20T09:00:00Z",
  },
];

export const INITIAL_APPROVALS: ApprovalItem[] = [
  {
    id: "upd-sample-browser-skill",
    title: "Install Browser Skill (v0.8.0)",
    source: "Skill Store",
    area: "Skill Permissions",
    status: "Waiting for Approval",
    problemOrReason:
      "Browser Skill is available in the JARVIS Skill Store to enhance sandboxed preview diagnostics.",
    proposedSolution:
      "Install Browser Skill in sandboxed mode with preview:iframe permission only.",
    securityImpact: "Low — restricted to sandboxed preview iframe; no external network or filesystem access.",
    beforePreview: "Browser Skill: Not Installed (Disabled)",
    afterPreview: "Browser Skill: Installed & Enabled (Permissions: preview:iframe)",
    actionType: "install_skill",
    actionPayload: { skillId: "browser" },
    createdAt: "2026-11-20T09:05:00Z",
    updatedAt: "2026-11-20T09:05:00Z",
  },
];

export const CLOUDFLARE_WORKER_REFERENCE = `// Cloudflare Worker Backend Proxy for JARVIS Standalone HTML / GitHub Pages
// 1. Create a free Worker at https://dash.cloudflare.com
// 2. Paste this code into Worker -> Edit Code -> Deploy
// 3. Go to Worker Settings -> Variables & Secrets -> Add Secret: GEMINI_API_KEY
// 4. Copy your Worker URL (e.g. https://jarvis-proxy.yourname.workers.dev) and paste it in
//    JARVIS Settings -> Studio & Tools -> Acode / HTML Export -> Backend Proxy URL

const MODEL_PRIMARY = "gemini-4-hydrogen";
const MODEL_FAST = "gemini-3.1-flash-lite";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function callGemini(apiKey, model, body) {
  const resp = await fetch(
    \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    }
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || "Gemini API error");
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname;
    const apiKey = (env.GEMINI_API_KEY || "").trim();

    if (path === "/api/gemini/health") {
      return json({
        backendOnline: true,
        apiKeyConfigured: Boolean(apiKey),
        model: MODEL_PRIMARY,
        fallbackModel: MODEL_FAST,
        timestamp: new Date().toISOString(),
      });
    }

    if (!apiKey) return json({ error: "GEMINI_API_KEY secret is not set in Cloudflare Worker." }, 503);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    try {
      const body = await request.json().catch(() => ({}));

      if (path === "/api/gemini/test") {
        const started = Date.now();
        const reply = await callGemini(apiKey, MODEL_FAST, {
          contents: [{ parts: [{ text: "Reply with: JARVIS_GEMINI_ONLINE" }] }],
        });
        return json({ ok: true, model: MODEL_FAST, latencyMs: Date.now() - started, reply, verifiedAt: new Date().toISOString() });
      }

      if (path === "/api/gemini/chat-stream") {
        const started = Date.now();
        const text = await callGemini(apiKey, body.deepResearch || body.reasoningMode ? MODEL_PRIMARY : MODEL_FAST, {
          systemInstruction: {
            parts: [{ text: "You are JARVIS, a fast Personal AI OS. Reply in the user's language (Bengali/Banglish or English)." }],
          },
          contents: [{ parts: [{ text: body.command || "" }] }],
        });
        const sse =
          \`data: \${JSON.stringify({ type: "chunk", text })}\\n\\n\` +
          \`data: \${JSON.stringify({ type: "done", model: MODEL_FAST, latencyMs: Date.now() - started, sources: [] })}\\n\\n\`;
        return new Response(sse, { headers: { ...CORS, "Content-Type": "text/event-stream; charset=utf-8" } });
      }

      if (path === "/api/gemini/self-scan") {
        const started = Date.now();
        const raw = await callGemini(apiKey, MODEL_FAST, {
          contents: [{ parts: [{ text: \`Scan snapshot and return JSON {overallHealth, detectedBugs:[], fixDescriptions:[], reportMessage, hasCodeFix:false}: \${JSON.stringify(body)}\` }] }],
          generationConfig: { responseMimeType: "application/json" },
        });
        return json({ ...JSON.parse(raw || "{}"), model: MODEL_FAST, latencyMs: Date.now() - started });
      }

      const raw = await callGemini(apiKey, MODEL_FAST, {
        contents: [{ parts: [{ text: JSON.stringify(body) }] }],
      });
      return json({ ok: true, response: raw, output: raw, model: MODEL_FAST });
    } catch (err) {
      return json({ error: String(err?.message || err) }, 500);
    }
  },
};`;
