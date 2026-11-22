import "dotenv/config";
import http from "http";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import zlib from "zlib";
import { execFile } from "child_process";
import { promisify } from "util";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_PRIMARY = "gemini-4-hydrogen";
const MODEL_FALLBACK = "gemini-3.1-flash-lite";
const MODEL_TTS = "gemini-3.8-flash-lite-tts";

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Please set it in Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Per-IP in-memory rate limiter for /api/gemini/*
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || "local";
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    next();
    return;
  }
  if (bucket.count >= 60) {
    res.status(429).json({
      error: "Rate limit exceeded. Please wait a moment before sending another request.",
    });
    return;
  }
  bucket.count += 1;
  next();
}

function isTransientError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    raw.includes("503") ||
    raw.includes("UNAVAILABLE") ||
    raw.includes("high demand") ||
    raw.includes("DEADLINE_EXCEEDED") ||
    raw.includes("ECONNRESET")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithResilience(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, "model"> & { model?: string }
): Promise<{ response: GenerateContentResponse; usedModel: string }> {
  const primary = params.model || MODEL_PRIMARY;
  let lastError: unknown;

  // Try primary model with exponential backoff on transient 503/network errors
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model: primary,
      });
      return { response, usedModel: primary };
    } catch (err) {
      lastError = err;
      if (!isTransientError(err)) {
        throw err;
      }
      await sleep(500 * (attempt + 1));
    }
  }

  // Fallback to gemini-3.1-flash-lite if primary is temporarily unavailable
  try {
    const fallbackConfig = params.config ? { ...params.config } : undefined;
    if (fallbackConfig?.thinkingConfig) {
      fallbackConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }
    const response = await ai.models.generateContent({
      ...params,
      model: MODEL_FALLBACK,
      config: fallbackConfig,
    });
    return { response, usedModel: MODEL_FALLBACK };
  } catch (fallbackErr) {
    throw fallbackErr || lastError;
  }
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("GEMINI_API_KEY is not configured")) {
    return { status: 503, message: raw };
  }
  if (raw.includes("PERMISSION_DENIED") || raw.includes("403")) {
    return {
      status: 403,
      message:
        "Gemini API permission denied. Please verify your API key in Settings > Secrets.",
    };
  }
  if (raw.includes("API_KEY_INVALID") || raw.includes("400")) {
    return {
      status: 400,
      message:
        "Invalid request or API key reported by Gemini API. Check Settings > Secrets.",
    };
  }
  if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("429")) {
    return {
      status: 429,
      message:
        "Gemini API quota exhausted (429). Please retry shortly or check quota settings.",
    };
  }
  if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("high demand")) {
    return {
      status: 503,
      message:
        "Gemini models are experiencing temporary high demand. Please retry in a few seconds.",
    };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      return { status: Number(parsed.error.code) || 500, message: parsed.error.message };
    }
  } catch {
    // Raw string is not JSON
  }
  return { status: 500, message: raw || "Unexpected Gemini backend error." };
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZipBuffer(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const rawData = entry.data;
    const deflated = zlib.deflateRawSync(rawData, { level: 6 });
    const useDeflate = deflated.length < rawData.length;
    const payload = useDeflate ? deflated : rawData;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(rawData);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralSize = centralParts.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function collectSafeProjectFiles(): string[] {
  const rootFiles = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "server.ts",
    ".env.example",
    "metadata.json",
  ];
  const collected: string[] = [];

  for (const rel of rootFiles) {
    const abs = path.join(__dirname, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      collected.push(rel);
    }
  }

  const walk = (dirRel: string, skipDirs: string[] = []) => {
    const absDir = path.join(__dirname, dirRel);
    if (!fs.existsSync(absDir)) return;
    const items = fs.readdirSync(absDir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith(".")) continue;
      const itemRel = path.posix.join(dirRel.replace(/\\/g, "/"), item.name);
      if (item.isDirectory()) {
        if (skipDirs.some((skip) => itemRel === skip || itemRel.startsWith(`${skip}/`))) {
          continue;
        }
        walk(itemRel, skipDirs);
      } else if (item.isFile()) {
        collected.push(itemRel);
      }
    }
  };

  walk("src");
  walk("public", ["public/assets/aistudio"]);
  return collected.sort();
}

const TEXT_SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".css", ".html", ".json", ".svg", ".md", ".example"]);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "6mb" }));

  // Export complete safe project as .zip for Android / Acode / Termux / GitHub
  app.get("/api/export/project-zip", (_req: Request, res: Response) => {
    try {
      const paths = collectSafeProjectFiles();
      const entries = paths.map((relPath) => ({
        name: `jarvis-ai-os/${relPath}`,
        data: fs.readFileSync(path.join(__dirname, relPath)),
      }));
      const zipBuffer = buildZipBuffer(entries);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="jarvis-ai-os-project.zip"');
      res.setHeader("Cache-Control", "no-store");
      res.send(zipBuffer);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to build project ZIP archive.",
      });
    }
  });

  // Return readable text source files for in-app browsing & 1-tap copy into Acode
  app.get("/api/export/source-files", (_req: Request, res: Response) => {
    try {
      const paths = collectSafeProjectFiles().filter((rel) => {
        const ext = path.extname(rel).toLowerCase();
        return TEXT_SOURCE_EXT.has(ext) || rel === ".env.example";
      });
      const files = paths.map((relPath) => {
        const abs = path.join(__dirname, relPath);
        const content = fs.readFileSync(abs, "utf8");
        return {
          path: relPath,
          size: Buffer.byteLength(content, "utf8"),
          content,
        };
      });
      res.json({ totalFiles: files.length, files });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to read project source files.",
      });
    }
  });

  // Build and download the real JARVIS AI OS as a single self-contained HTML file (for Acode & GitHub Pages)
  app.get("/api/export/standalone-html", async (_req: Request, res: Response) => {
    try {
      const distDir = path.join(__dirname, "dist");
      const distIndexPath = path.join(distDir, "index.html");
      if (!fs.existsSync(distIndexPath)) {
        await execFileAsync("npx", ["vite", "build"], { cwd: __dirname });
      }
      if (!fs.existsSync(distIndexPath)) {
        res.status(500).json({ error: "Production dist/index.html could not be generated." });
        return;
      }

      let html = fs.readFileSync(distIndexPath, "utf8");

      // Strip PWA service worker / manifest tags that break in single-file or file:// Acode preview
      html = html
        .replace(/<link[^>]+rel=["']manifest["'][^>]*>/gi, "")
        .replace(/<script[^>]+id=["']vite-plugin-pwa:register-sw["'][^>]*><\/script>/gi, "");

      // Inline favicon SVG cleanly if available
      const svgIconPath = path.join(__dirname, "public", "icon.svg");
      if (fs.existsSync(svgIconPath)) {
        const svgB64 = fs.readFileSync(svgIconPath).toString("base64");
        html = html.replace(
          /href=["']\/icon\.svg["']/gi,
          `href="data:image/svg+xml;base64,${svgB64}"`
        );
      }

      // Inline built stylesheet(s)
      html = html.replace(
        /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'](\/assets\/[^"']+)["'][^>]*>/gi,
        (fullMatch, assetRel: string) => {
          const cssPath = path.join(distDir, assetRel.replace(/^\//, ""));
          if (!fs.existsSync(cssPath)) return fullMatch;
          const cssText = fs.readFileSync(cssPath, "utf8").replace(/<\/style/gi, "<\\/style");
          return `<style>\n${cssText}\n</style>`;
        }
      );

      // Extract built JS bundle(s), inline local JPG assets as data URIs, and place module script at end of body
      const inlineScripts: string[] = [];
      html = html.replace(
        /<script\b[^>]*type=["']module["'][^>]*src=["'](\/assets\/[^"']+)["'][^>]*><\/script>/gi,
        (fullMatch, assetRel: string) => {
          const jsPath = path.join(distDir, assetRel.replace(/^\//, ""));
          if (!fs.existsSync(jsPath)) return fullMatch;
          let jsText = fs.readFileSync(jsPath, "utf8");

          const imgDir = path.join(__dirname, "src", "assets", "images");
          if (fs.existsSync(imgDir)) {
            for (const file of fs.readdirSync(imgDir)) {
              if (!/\.(jpe?g|png|webp|svg)$/i.test(file)) continue;
              const imgPath = path.join(imgDir, file);
              const ext = path.extname(file).toLowerCase();
              const mime =
                ext === ".png"
                  ? "image/png"
                  : ext === ".webp"
                    ? "image/webp"
                    : ext === ".svg"
                      ? "image/svg+xml"
                      : "image/jpeg";
              const dataUri = `data:${mime};base64,${fs.readFileSync(imgPath).toString("base64")}`;
              jsText = jsText.split(`/src/assets/images/${file}`).join(dataUri);
            }
          }

          inlineScripts.push(`<script type="module">\n${jsText.replace(/<\/script/gi, "<\\/script")}\n</script>`);
          return "";
        }
      );

      if (inlineScripts.length > 0) {
        html = html.replace("</body>", `${inlineScripts.join("\n")}\n</body>`);
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="jarvis-ai-os.html"');
      res.setHeader("Cache-Control", "no-store");
      res.send(html);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to bundle standalone JARVIS HTML.",
      });
    }
  });

  app.get("/api/gemini/health", (_req: Request, res: Response) => {
    const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
    res.json({
      backendOnline: true,
      apiKeyConfigured: configured,
      model: MODEL_PRIMARY,
      fallbackModel: MODEL_FALLBACK,
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/gemini/test", rateLimit, async (_req: Request, res: Response) => {
    const started = Date.now();
    try {
      const ai = createGeminiClient();
      const { response, usedModel } = await generateWithResilience(ai, {
        contents: "Reply with the exact string: JARVIS_GEMINI_ONLINE",
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const latencyMs = Date.now() - started;
      const text = (response.text ?? "").trim();
      res.json({
        ok: true,
        model: usedModel,
        latencyMs,
        reply: text,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({
        ok: false,
        model: MODEL_PRIMARY,
        latencyMs: Date.now() - started,
        error: message,
      });
    }
  });

  // Streaming AI Assistant endpoint with Deep Research (Google Search + URL Context), Reasoning, & File Attachments
  app.post("/api/gemini/chat-stream", rateLimit, async (req: Request, res: Response) => {
    const started = Date.now();
    const {
      command,
      memories,
      activeSkills,
      history,
      routingPreferences,
      deepResearch,
      reasoningMode,
      attachment,
    } = req.body ?? {};

    if (typeof command !== "string" || !command.trim()) {
      res.status(400).json({ error: "Command text is required." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const ai = createGeminiClient();
      const conciseMemories = Array.isArray(memories)
        ? memories.slice(0, 5).map((m: { title?: string; content?: string }) => `${m.title}: ${String(m.content || "").slice(0, 140)}`)
        : [];
      const conciseSkills = Array.isArray(activeSkills) ? activeSkills.slice(0, 14) : [];

      const systemInstruction = `You are JARVIS, a fast, intelligent Personal AI OS.
Reply in the user's language (Bengali/Banglish if they use Bengali/Banglish, English if English). Keep answers clear, direct, and concise unless asked for detail.
You have LIVE built-in controls over Theme (Dark/Light/Adaptive), Accent Palette (Cosmic Violet/Cyber Cyan/Emerald Matrix/Rose Aurora/Solar Gold), Animation, and Program Self-Scan & Auto-Heal. Confirm naturally when applying them.
Active Skills: ${conciseSkills.join(", ")}
Memories: ${conciseMemories.join(" | ")}${
        deepResearch
          ? "\nDeep Research ON: use Google Search / URL Context and cite verified facts concisely."
          : ""
      }${
        reasoningMode
          ? "\nReasoning ON: provide step-by-step analysis before your final answer."
          : ""
      }`;

      const recentContext = Array.isArray(history)
        ? history
            .slice(-4)
            .map((m: { role?: string; content?: string }) => `${m.role || "user"}: ${String(m.content || "").slice(0, 400)}`)
            .join("\n")
        : "";

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (attachment && typeof attachment === "object") {
        if (attachment.base64Data && attachment.mimeType) {
          parts.push({
            inlineData: {
              mimeType: String(attachment.mimeType),
              data: String(attachment.base64Data),
            },
          });
        } else if (attachment.textContent) {
          parts.push({
            text: `Attached file (${attachment.name || "file"}):\n\`\`\`\n${String(
              attachment.textContent
            ).slice(0, 24000)}\n\`\`\``,
          });
        }
      }

      const promptText = recentContext
        ? `Recent chat:\n${recentContext}\n\nUser:\n${command.trim()}`
        : command.trim();
      parts.push({ text: promptText });

      const useDeepModel = Boolean(reasoningMode || deepResearch);
      const streamModel = useDeepModel ? MODEL_PRIMARY : MODEL_FALLBACK;
      const streamBackupModel = useDeepModel ? MODEL_FALLBACK : MODEL_PRIMARY;

      const config: GenerateContentParameters["config"] = {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: useDeepModel
            ? reasoningMode
              ? ThinkingLevel.HIGH
              : ThinkingLevel.LOW
            : ThinkingLevel.MINIMAL,
        },
      };

      if (deepResearch) {
        config.tools = [{ googleSearch: {} }, { urlContext: {} }];
      }

      // Only run Gemini intent classification when message hints at a theme/scan/animation command (0ms overhead on normal chats)
      const mightBeAction =
        /theme|থিম|color|কালার|রং|light|dark|adaptive|লাইট|ডার্ক|সুন্দর|change|চেঞ্জ|প্যালেট|cyan|emerald|rose|gold|violet|blue|green|red|scan|স্ক্যান|bug|বাগ|glitch|গ্লিচ|fix|ঠিক|repair|animation|অ্যানিমেশন/i.test(
          command
        );

      const actionPromise = mightBeAction
        ? (async () => {
            try {
              const actionResp = await ai.models.generateContent({
                model: MODEL_FALLBACK,
                contents: command.trim(),
                config: {
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                  systemInstruction: `Classify if the user's message requests an immediate OS action:
1. "change_theme": change/beautify theme, mode (light/dark/adaptive), or color (cosmic-violet/cyber-cyan/emerald-matrix/rose-aurora/solar-gold, or cycle_pretty if unspecified).
2. "scan_and_heal": scan app/program/phone/website for bugs or glitches and fix them.
3. "toggle_animation": turn animations on/off.
4. "none": normal question/chat.`,
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      actionType: { type: Type.STRING },
                      themeMode: { type: Type.STRING },
                      accentTheme: { type: Type.STRING },
                      animationEnabled: { type: Type.BOOLEAN },
                      actionSummary: { type: Type.STRING },
                    },
                    required: ["actionType"],
                  },
                },
              });
              return JSON.parse((actionResp.text ?? '{"actionType":"none"}').trim());
            } catch {
              return { actionType: "none" };
            }
          })()
        : Promise.resolve({ actionType: "none" });

      let usedModel = streamModel;
      let stream: AsyncGenerator<GenerateContentResponse>;

      try {
        stream = await ai.models.generateContentStream({
          model: streamModel,
          contents: { parts },
          config,
        });
      } catch (primaryErr) {
        if (!isTransientError(primaryErr)) throw primaryErr;
        usedModel = streamBackupModel;
        const fallbackConfig = { ...config };
        fallbackConfig.thinkingConfig = {
          thinkingLevel: streamBackupModel === MODEL_FALLBACK ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
        };
        stream = await ai.models.generateContentStream({
          model: streamBackupModel,
          contents: { parts },
          config: fallbackConfig,
        });
      }

      const sourcesMap = new Map<string, string>();

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
          sendEvent({ type: "chunk", text: chunkText });
        }
        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (Array.isArray(groundingChunks)) {
          for (const gc of groundingChunks) {
            if (gc.web?.uri) {
              sourcesMap.set(gc.web.uri, gc.web.title || gc.web.uri);
            }
          }
        }
      }

      const detectedAction = await actionPromise;
      if (detectedAction && detectedAction.actionType && detectedAction.actionType !== "none") {
        sendEvent({ type: "action", action: detectedAction });
      }

      const sources = Array.from(sourcesMap.entries()).map(([uri, title]) => ({
        uri,
        title,
      }));

      sendEvent({
        type: "done",
        model: usedModel,
        latencyMs: Date.now() - started,
        sources,
        deepResearch: Boolean(deepResearch),
        reasoningMode: Boolean(reasoningMode),
      });
      res.end();
    } catch (err) {
      const { message } = formatGeminiError(err);
      sendEvent({ type: "error", error: message });
      res.end();
    }
  });

  // Structured AI Brain routing + execution endpoint (used by BrainView, VoiceView, and structured actions)
  app.post("/api/gemini/brain", rateLimit, async (req: Request, res: Response) => {
    const started = Date.now();
    try {
      const { command, memories, activeSkills, history, routingPreferences, deepResearch } =
        req.body ?? {};
      if (typeof command !== "string" || !command.trim()) {
        res.status(400).json({ error: "Command text is required." });
        return;
      }

      const ai = createGeminiClient();

      const systemInstruction = `You are JARVIS, a Personal AI Operating System.
Respond in the user's language (if the user writes in Bengali or Banglish, reply naturally in clear Banglish/Bengali or match their tone; if English, reply in crisp English).
Analyze the user's command as the Central AI Brain:
1. Identify the primary task category (Coding, Web Development, Research, Writing, GitHub, System Diagnostics, Self-Evolution, Memory, Voice, Data Analysis, Translation, Document Creation, or General).
2. Select which installed skills from the user's active skill list should be engaged.
3. Respect the user's strict security rule: "JARVIS CAN THINK, ANALYZE, PLAN AND PREPARE IMPROVEMENTS. BUT IT MUST NEVER APPLY IMPORTANT CHANGES WITHOUT EXPLICIT USER PERMISSION."
4. Use any provided Memory Context accurately.
5. If the user asks to build a website/app/component or write code, set suggestedActionType to "code_studio" and provide clean starter HTML/CSS/JS inside suggestedCodeHtml/Css/Js if helpful.
6. If the user asks to improve JARVIS itself, change settings, or install/modify system behavior, set suggestedActionType to "approval_proposal".
7. If the user explicitly asks you to remember a preference or project detail, set suggestedActionType to "save_memory".
Active Skills: ${JSON.stringify(activeSkills ?? [])}
Routing Preferences: ${JSON.stringify(routingPreferences ?? {})}
Relevant Memories: ${JSON.stringify(memories ?? [])}`;

      const recentContext = Array.isArray(history)
        ? history
            .slice(-6)
            .map((m: { role?: string; content?: string }) => `${m.role || "user"}: ${m.content || ""}`)
            .join("\n")
        : "";

      const fullPrompt = recentContext
        ? `Recent conversation:\n${recentContext}\n\nCurrent user command:\n${command.trim()}`
        : command.trim();

      const { response, usedModel } = await generateWithResilience(ai, {
        model: deepResearch ? MODEL_PRIMARY : MODEL_FALLBACK,
        contents: fullPrompt,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: deepResearch ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
          },
          tools: deepResearch ? [{ googleSearch: {} }] : undefined,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              selectedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
              reasoning: { type: Type.STRING },
              executionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
              response: { type: Type.STRING },
              suggestedActionType: { type: Type.STRING },
              suggestedActionTitle: { type: Type.STRING },
              suggestedMemoryContent: { type: Type.STRING },
              suggestedCodeHtml: { type: Type.STRING },
              suggestedCodeCss: { type: Type.STRING },
              suggestedCodeJs: { type: Type.STRING },
            },
            required: [
              "category",
              "selectedSkills",
              "reasoning",
              "executionPlan",
              "response",
              "suggestedActionType",
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json({
        ...parsed,
        executedModel: usedModel,
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Coding Studio endpoint: generate, explain, debug, improve
  app.post("/api/gemini/code", rateLimit, async (req: Request, res: Response) => {
    const started = Date.now();
    try {
      const { prompt, mode, html, css, js, consoleErrors } = req.body ?? {};
      if (typeof prompt !== "string" && mode === "generate") {
        res.status(400).json({ error: "A coding prompt is required." });
        return;
      }

      const ai = createGeminiClient();
      const safeMode = mode || "generate";

      const systemInstruction = `You are the JARVIS Coding Studio engine.
Mode: ${safeMode}.
Rules:
- Produce clean, responsive, modern, self-contained HTML, CSS, and vanilla JavaScript compatible with single-file export and mobile browsers (Acode / GitHub Pages).
- In "html", provide only the markup that goes inside <body>...</body> (do not include <html>, <head>, or <body> wrapper tags).
- In "explain", explain the current code clearly and return the unchanged code.
- In "debug", identify concrete HTML/CSS/JS bugs (including any captured runtime consoleErrors) and provide fixed html/css/js.
- In "improve", enhance responsiveness, accessibility, and code structure and return updated html/css/js.`;

      const userContent = `User instruction: ${prompt || "Analyze current workspace code"}
${
  Array.isArray(consoleErrors) && consoleErrors.length > 0
    ? `\nCaptured Runtime Console Errors:\n${consoleErrors.join("\n")}`
    : ""
}

Current HTML:
\`\`\`html
${html || ""}
\`\`\`

Current CSS:
\`\`\`css
${css || ""}
\`\`\`

Current JS:
\`\`\`js
${js || ""}
\`\`\``;

      const { response, usedModel } = await generateWithResilience(ai, {
        contents: userContent,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              explanation: { type: Type.STRING },
              issuesFound: { type: Type.ARRAY, items: { type: Type.STRING } },
              html: { type: Type.STRING },
              css: { type: Type.STRING },
              js: { type: Type.STRING },
            },
            required: ["summary", "explanation", "issuesFound", "html", "css", "js"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json({
        ...parsed,
        model: usedModel,
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Self-Scan & Auto-Heal endpoint (runs when API connects or when user requests bug/glitch scan)
  app.post("/api/gemini/self-scan", rateLimit, async (req: Request, res: Response) => {
    const started = Date.now();
    try {
      const { trigger, localIssues, systemSnapshot, activeProject, languageHint } = req.body ?? {};
      const ai = createGeminiClient();

      const hasLocalIssues =
        Array.isArray(localIssues) && localIssues.some((i: { status?: string }) => i?.status && i.status !== "pass");

      const { response, usedModel } = await generateWithResilience(ai, {
        model: hasLocalIssues ? MODEL_PRIMARY : MODEL_FALLBACK,
        contents: `Scan Trigger: ${trigger || "manual"}
Preferred Language Hint: ${languageHint || "Bangla/Banglish"}
Detected Local Diagnostics Issues: ${JSON.stringify(localIssues ?? [])}
System Snapshot: ${JSON.stringify(systemSnapshot ?? {})}
Active Coding Project (${activeProject?.name || "None"}):
HTML:
${String(activeProject?.html ?? "").slice(0, 4000)}
CSS:
${String(activeProject?.css ?? "").slice(0, 2000)}
JS:
${String(activeProject?.js ?? "").slice(0, 3000)}`,
        config: {
          systemInstruction: `You are JARVIS's Autonomous Program Scanner & Self-Healer.
Your job:
1. Inspect the provided program diagnostics, browser/device capabilities, security lock state, and active Coding Studio HTML/CSS/JS code for any real bugs, syntax errors, glitches, or misconfigurations.
2. Explain clearly in friendly Bengali/Banglish (or match languageHint) whether any bugs/glitches were found on their phone/browser, website/project, or JARVIS program, and what fixes were applied.
3. If the active Coding Studio HTML/CSS/JS has a concrete bug (unclosed tags, syntax error, broken DOM/script), set hasCodeFix=true and return clean corrected repairedHtml, repairedCss, and repairedJs. Otherwise set hasCodeFix=false and keep empty strings.`,
          thinkingConfig: {
            thinkingLevel: hasLocalIssues ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
          },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallHealth: { type: Type.STRING },
              detectedBugs: { type: Type.ARRAY, items: { type: Type.STRING } },
              fixDescriptions: { type: Type.ARRAY, items: { type: Type.STRING } },
              reportMessage: { type: Type.STRING },
              hasCodeFix: { type: Type.BOOLEAN },
              repairedHtml: { type: Type.STRING },
              repairedCss: { type: Type.STRING },
              repairedJs: { type: Type.STRING },
            },
            required: ["overallHealth", "detectedBugs", "fixDescriptions", "reportMessage", "hasCodeFix"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json({
        ...parsed,
        model: usedModel,
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Self-Evolution analyzer endpoint -> outputs proposals for Update Approval Center
  app.post("/api/gemini/evolve", rateLimit, async (req: Request, res: Response) => {
    const started = Date.now();
    try {
      const { goal, systemSnapshot } = req.body ?? {};
      const ai = createGeminiClient();

      const { response, usedModel } = await generateWithResilience(ai, {
        contents: `Goal: ${
          goal || "Analyze JARVIS system architecture and propose practical improvements."
        }
Current System Snapshot:
${JSON.stringify(systemSnapshot ?? {}, null, 2)}`,
        config: {
          systemInstruction: `You are the JARVIS Self-Evolution Engine.
Analyze the provided system snapshot (theme, active skills, model routing, memory stats, diagnostics results).
Generate 2 or 3 realistic, high-value improvement proposals.
Each proposal MUST require explicit user approval before taking effect.
Supported targetAction types:
- "toggle_theme": targetValue can be "light", "dark", or "adaptive"
- "enable_skill": targetValue is an existing skill id from the snapshot
- "add_memory_rule": targetValue is a concise system rule or preference string
- "update_routing": targetValue is a JSON string like {"task":"Coding","model":"gemini-4-hydrogen"}
- "config_hardening": targetValue is a descriptive hardening flag`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysisSummary: { type: Type.STRING },
              proposals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    area: { type: Type.STRING },
                    problem: { type: Type.STRING },
                    solution: { type: Type.STRING },
                    securityImpact: { type: Type.STRING },
                    beforeState: { type: Type.STRING },
                    afterState: { type: Type.STRING },
                    targetAction: { type: Type.STRING },
                    targetValue: { type: Type.STRING },
                  },
                  required: [
                    "title",
                    "area",
                    "problem",
                    "solution",
                    "securityImpact",
                    "beforeState",
                    "afterState",
                    "targetAction",
                    "targetValue",
                  ],
                },
              },
            },
            required: ["analysisSummary", "proposals"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json({
        ...parsed,
        model: usedModel,
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Sandboxed Skill Test runner
  app.post("/api/gemini/skill-test", rateLimit, async (req: Request, res: Response) => {
    const started = Date.now();
    try {
      const { skillName, skillDescription, permissions, testInput } = req.body ?? {};
      if (!skillName || !testInput) {
        res.status(400).json({ error: "skillName and testInput are required." });
        return;
      }

      const ai = createGeminiClient();
      const { response, usedModel } = await generateWithResilience(ai, {
        contents: `Execute a sandboxed test for skill "${skillName}".
Description: ${skillDescription || ""}
Permissions granted: ${JSON.stringify(permissions || [])}
User test input: ${testInput}`,
        config: {
          systemInstruction:
            "You are running a sandboxed test of a JARVIS skill. Demonstrate how the skill processes the test input cleanly and safely without executing destructive actions.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({
        ok: true,
        output: response.text ?? "",
        model: usedModel,
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Natural Text-to-Speech via Gemini TTS (free-tier compatible gemini-3.8-flash-lite-tts)
  app.post("/api/gemini/tts", rateLimit, async (req: Request, res: Response) => {
    try {
      const { text, voiceName } = req.body ?? {};
      if (typeof text !== "string" || !text.trim()) {
        res.status(400).json({ error: "Text is required for TTS." });
        return;
      }
      const ai = createGeminiClient();
      const response = await ai.models.generateContent({
        model: MODEL_TTS,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: text.trim().slice(0, 1200),
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: typeof voiceName === "string" ? voiceName : "Kore",
              },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: "No audio generated by TTS model." });
        return;
      }
      res.json({
        ok: true,
        mimeType: "audio/wav",
        base64Audio,
        model: MODEL_TTS,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Public read-only GitHub repository inspector
  app.get("/api/github/repo", async (req: Request, res: Response) => {
    try {
      const owner = String(req.query.owner ?? "").trim();
      const repo = String(req.query.repo ?? "").trim();
      if (!owner || !repo || !/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
        res.status(400).json({ error: "Valid GitHub owner and repo name are required." });
        return;
      }

      const headers = {
        Accept: "application/vnd.github+json",
        "User-Agent": "jarvis-personal-ai-os",
      };

      const [repoResp, contentsResp] = await Promise.all([
        fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
          { headers }
        ),
        fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
            repo
          )}/contents`,
          { headers }
        ),
      ]);

      if (!repoResp.ok) {
        const errBody = await repoResp.text();
        res.status(repoResp.status).json({
          error: `GitHub API returned ${repoResp.status}: ${errBody.slice(0, 200)}`,
        });
        return;
      }

      const repoData = await repoResp.json();
      const contentsData = contentsResp.ok ? await contentsResp.json() : [];

      res.json({
        repo: {
          fullName: repoData.full_name,
          description: repoData.description,
          defaultBranch: repoData.default_branch,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          language: repoData.language,
          hasPages: repoData.has_pages,
          updatedAt: repoData.updated_at,
          htmlUrl: repoData.html_url,
          visibility: repoData.visibility,
        },
        files: Array.isArray(contentsData)
          ? contentsData
              .slice(0, 25)
              .map((item: { name: string; type: string; size: number; path: string }) => ({
                name: item.name,
                type: item.type,
                size: item.size,
                path: item.path,
              }))
          : [],
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to query GitHub public API.",
      });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    process.env.DISABLE_HMR = process.env.DISABLE_HMR ?? "true";
    if (process.env.DISABLE_HMR === "true") {
      app.get("/@vite/client", (_req: Request, res: Response) => {
        res.type("application/javascript").send(`
const sheets = new Map();
export class ErrorOverlay extends HTMLElement {}
export function createHotContext() {
  return {
    accept() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function updateStyle(id, content) {
  let style = sheets.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    document.head.appendChild(style);
    sheets.set(id, style);
  }
  style.textContent = content;
}
export function removeStyle(id) {
  const style = sheets.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheets.delete(id);
  }
}
export function injectQuery(url) {
  return url;
}
`);
      });
    }
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`JARVIS Personal AI OS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
