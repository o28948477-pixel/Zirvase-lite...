import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Square, Send, Loader2 } from "lucide-react";
import type { JarvisStore } from "../hooks/useJarvisStore";
import { resolveApiUrl } from "../utils/apiUrl";

interface VoiceViewProps {
  store: JarvisStore;
}

interface SpeechRecLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function VoiceView({ store }: VoiceViewProps) {
  const { state, logActivity } = store;

  const speechRecSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const speechSynthSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [useStudioTts, setUseStudioTts] = useState(true);
  const [rate, setRate] = useState(1.0);
  const [lang, setLang] = useState(() =>
    state.uiPrefs.voiceLanguage.includes("Bangla")
      ? "bn-BD"
      : state.uiPrefs.voiceLanguage.includes("UK")
      ? "en-GB"
      : "en-US"
  );
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const recRef = useRef<SpeechRecLike | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const stopWaveform = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
    // Draw idle flat baseline on canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(37, 99, 235, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
    }
  };

  const startWaveform = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const timeData = new Uint8Array(bufferLength);
      const freqData = new Uint8Array(bufferLength);

      const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        let sum = 0;
        for (let i = 0; i < freqData.length; i++) sum += freqData[i];
        const avg = Math.round((sum / freqData.length / 255) * 100);
        setAudioLevel(avg);

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Frequency bars background
        const barCount = 40;
        const step = Math.floor(freqData.length / barCount);
        const barWidth = w / barCount;
        for (let i = 0; i < barCount; i++) {
          const v = freqData[i * step] / 255;
          const barH = Math.max(4, v * (h * 0.72));
          ctx.fillStyle = "rgba(37, 99, 235, 0.22)";
          ctx.fillRect(
            i * barWidth + 2,
            (h - barH) / 2,
            Math.max(2, barWidth - 4),
            barH
          );
        }

        // Real-time oscilloscope waveform trace
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = "#2563EB";
        ctx.beginPath();
        const sliceWidth = w / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        rafRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch {
      // Microphone visualization is optional if permission denied
    }
  };

  useEffect(() => {
    stopWaveform();
    return () => {
      recRef.current?.stop();
      stopWaveform();
      audioElRef.current?.pause();
      if (speechSynthSupported) {
        window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAllSpeech = () => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    if (speechSynthSupported) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  const speakBrowserFallback = (text: string) => {
    if (!speechSynthSupported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.lang = lang;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const speakText = async (text: string) => {
    if (!text.trim()) return;
    stopAllSpeech();

    if (useStudioTts) {
      try {
        setSpeaking(true);
        const resp = await fetch(resolveApiUrl("/api/gemini/tts"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceName: "Kore" }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.base64Audio) {
          throw new Error(data.error || "TTS fallback");
        }
        const audio = new Audio(`data:${data.mimeType || "audio/wav"};base64,${data.base64Audio}`);
        audio.playbackRate = rate;
        audioElRef.current = audio;
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => {
          setSpeaking(false);
          speakBrowserFallback(text);
        };
        await audio.play();
        return;
      } catch {
        setSpeaking(false);
        speakBrowserFallback(text);
        return;
      }
    }

    speakBrowserFallback(text);
  };

  const sendVoiceCommand = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(resolveApiUrl("/api/gemini/brain"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: clean,
          memories: state.memories
            .filter((m) => m.activeInContext)
            .map((m) => ({ type: m.type, title: m.title, content: m.content })),
          activeSkills: state.skills
            .filter((s) => s.installed && s.enabled)
            .map((s) => s.name),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Voice Brain request failed");
      const out = data.response || "";
      setReply(out);
      logActivity("Voice Assistant", "Voice Command Processed", clean);
      if (autoSpeak && out) {
        await speakText(out);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice command failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (!speechRecSupported) {
      setError("SpeechRecognition is not supported in this browser. You can type a command below.");
      return;
    }

    if (listening) {
      recRef.current?.stop();
      stopWaveform();
      setListening(false);
      return;
    }

    setError(null);
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecLike;
      webkitSpeechRecognition?: new () => SpeechRecLike;
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      setTranscript(text);
      if (text) {
        sendVoiceCommand(text);
      }
    };
    rec.onerror = (event) => {
      setError(`Microphone error: ${event.error}`);
      stopWaveform();
      setListening(false);
    };
    rec.onend = () => {
      stopWaveform();
      setListening(false);
    };

    recRef.current = rec;
    rec.start();
    startWaveform();
    setListening(true);
  };

  return (
    <div className="space-y-6">
      <section className="jarvis-surface p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-blue-500/25">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Voice Assistant &amp; Audio Waveform
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Real-time Web Audio API waveform feedback with browser SpeechRecognition and Gemini
              Studio TTS.
            </p>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Mic Input: {speechRecSupported ? "Supported" : "Unavailable"} · Voice Output:{" "}
            {useStudioTts ? "Gemini Studio TTS" : speechSynthSupported ? "Browser" : "Unavailable"}
          </div>
        </div>

        {/* Real-time Web Audio API Waveform Canvas */}
        <div className="rounded-xl border border-zinc-200 dark:border-blue-500/25 bg-zinc-50/90 dark:bg-[#060C20] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{listening ? "Actively Listening (Live Audio Waveform)" : "Audio Input Idle"}</span>
            <span className="font-mono tabular-nums">Level: {audioLevel}%</span>
          </div>
          <canvas
            ref={canvasRef}
            width={760}
            height={110}
            className="w-full h-28 rounded-lg bg-white dark:bg-[#0B132B] border border-zinc-200/70 dark:border-blue-500/25"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Recognition Language
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
            >
              <option value="en-US">English (US)</option>
              <option value="bn-BD">Bengali (Bangladesh)</option>
              <option value="en-GB">English (UK)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Speech Rate ({rate.toFixed(1)}x)
            </label>
            <input
              type="range"
              min="0.7"
              max="1.5"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full mt-2 accent-blue-600"
            />
          </div>

          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
                className="rounded border-zinc-300 text-blue-600"
              />
              <span>Speak JARVIS replies automatically</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useStudioTts}
                onChange={(e) => setUseStudioTts(e.target.checked)}
                className="rounded border-zinc-300 text-blue-600"
              />
              <span>Use Gemini Natural Studio Voice</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={toggleListening}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-colors whitespace-nowrap ${
              listening
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{listening ? "Stop Listening" : "Start Voice Input"}</span>
          </button>

          {speaking && (
            <button
              type="button"
              onClick={stopAllSpeech}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-blue-500/30 text-zinc-700 dark:text-zinc-200"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop Speech</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder='Try "Hello JARVIS, check my system status" or speak into mic...'
            className="flex-1 min-w-0 px-3.5 py-2.5 text-sm rounded-xl bg-zinc-50 dark:bg-[#060C20] border border-zinc-200 dark:border-blue-500/25 text-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            disabled={loading || !transcript.trim()}
            onClick={() => sendVoiceCommand(transcript)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Send Command</span>
          </button>
        </div>
      </section>

      {reply && (
        <section className="jarvis-surface p-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
              JARVIS Voice Response
            </h3>
            <button
              type="button"
              onClick={() => speakText(reply)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Replay Audio</span>
            </button>
          </div>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
            {reply}
          </p>
        </section>
      )}
    </div>
  );
}
