import { JarvisOrb } from "./JarvisOrb";

interface JarvisCompanionStageProps {
  isTalking: boolean;
  isListening: boolean;
  online: boolean;
  animated?: boolean;
  compact?: boolean;
}

export function JarvisCompanionStage({
  isTalking,
  isListening,
  online,
  animated = true,
  compact = false,
}: JarvisCompanionStageProps) {
  const activeState = isTalking || isListening;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl transition-all duration-300 ${
        compact ? "px-4 py-3 flex items-center justify-between gap-4" : "px-4 pt-4 pb-5 text-center"
      }`}
    >
      {/* Flowing Neon Backlight Aura behind Orb */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ${
          compact ? "w-48 h-28" : "w-64 h-64"
        } ${animated && activeState ? "animate-jarvis-neon" : ""}`}
        style={{
          background: isListening
            ? "radial-gradient(circle, rgba(244,63,94,0.42) 0%, rgba(168,85,247,0.28) 48%, transparent 74%)"
            : isTalking
            ? "radial-gradient(circle, rgba(168,85,247,0.52) 0%, rgba(56,189,248,0.34) 48%, transparent 74%)"
            : "radial-gradient(circle, rgba(139,92,246,0.32) 0%, rgba(56,189,248,0.16) 48%, transparent 74%)",
          filter: "blur(22px)",
        }}
      />

      {compact ? (
        <>
          <div className="relative z-10 flex items-center gap-3.5">
            <JarvisOrb size="md" animated={animated} active={activeState} />
            <div className="text-left">
              <h2 className="font-display text-sm sm:text-base font-bold tracking-wide text-zinc-900 dark:text-white">
                JARVIS AI
              </h2>
              <p className="text-xs text-zinc-600 dark:text-violet-200/85">
                {isListening
                  ? "Listening to your voice..."
                  : isTalking
                  ? "Speaking & replying to you..."
                  : online
                  ? "Always here for you..."
                  : "Backend key missing"}
              </p>
            </div>
          </div>

          <div
            className="relative z-10 flex items-center gap-1 h-7 px-3 rounded-full bg-violet-500/12 border border-violet-400/30"
            aria-hidden="true"
          >
            {[0.45, 0.85, 0.65, 1, 0.7, 0.9, 0.5].map((scale, i) => (
              <span
                key={i}
                className={`w-1 rounded-full origin-center transition-all ${
                  activeState
                    ? i % 2 === 0
                      ? "bg-violet-400 animate-jarvis-talk-1"
                      : "bg-cyan-400 animate-jarvis-talk-2"
                    : "bg-violet-400/55"
                }`}
                style={{ height: `${Math.round(scale * 18)}px` }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center gap-3">
          <div className="relative flex items-center justify-center">
            <svg
              viewBox="0 0 140 140"
              className={`absolute -inset-3 w-[calc(100%+1.5rem)] h-[calc(100%+1.5rem)] pointer-events-none ${
                animated ? "animate-jarvis-spin" : ""
              }`}
              aria-hidden="true"
            >
              <circle
                cx="70"
                cy="70"
                r="64"
                fill="none"
                stroke="rgba(167,139,250,0.4)"
                strokeWidth="1.2"
                strokeDasharray="36 18 14 14"
              />
            </svg>
            <JarvisOrb size="lg" animated={animated} active={activeState} />
          </div>

          <div className="space-y-0.5">
            <h2 className="font-display text-2xl font-bold tracking-wide text-zinc-900 dark:text-white">
              JARVIS AI
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-slate-300">
              {isListening
                ? "Listening to your voice..."
                : isTalking
                ? "Speaking & replying to you..."
                : online
                ? "Always here for you..."
                : "Backend API key missing"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
