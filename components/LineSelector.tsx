"use client";

import { useSlotStore } from "@/lib/store";

export default function LineSelector() {
  const lines = useSlotStore((s) => s.lines);
  const setLines = useSlotStore((s) => s.setLines);
  const spinning = useSlotStore((s) => s.spinning);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 font-mono uppercase tracking-wider mr-1">Lines</span>
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <button
          key={n}
          onClick={() => setLines(n)}
          disabled={spinning}
          className={[
            "w-8 h-8 rounded text-sm font-bold font-mono transition-all border",
            lines >= n
              ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_8px_rgba(59,130,246,0.4)]"
              : "bg-[#111827] border-[#1e2d4a] text-slate-400 hover:border-blue-600",
            spinning ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          ].join(" ")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
