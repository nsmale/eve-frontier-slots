"use client";

import { useSlotStore } from "@/lib/store";

export default function LineSelector() {
  const lines = useSlotStore((s) => s.lines);
  const setLines = useSlotStore((s) => s.setLines);
  const spinning = useSlotStore((s) => s.spinning);

  return (
    <div className="flex items-center gap-3">
      <span className="hud-label" style={{ minWidth: 40 }}>Lines</span>
      <div className="flex gap-1.5">
        {([1, 2, 3, 4, 5] as const).map((n) => {
          const active = lines >= n;
          return (
            <button
              key={n}
              onClick={() => setLines(n)}
              disabled={spinning}
              style={{
                width: 34,
                height: 34,
                background: active ? "var(--teal)" : "transparent",
                color: active ? "#0A0A0A" : "rgba(24,124,155,0.6)",
                border: `1px solid ${active ? "var(--teal)" : "rgba(24,124,155,0.25)"}`,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                cursor: spinning ? "not-allowed" : "pointer",
                opacity: spinning ? 0.45 : 1,
                transition: "all 0.15s",
                borderRadius: 0,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
