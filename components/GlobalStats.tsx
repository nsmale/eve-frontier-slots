"use client";

import { useSlotStore } from "@/lib/store";

export default function GlobalStats() {
  const stats = useSlotStore((s) => s.stats);

  const items = [
    { label: "Spins", value: stats.spins.toLocaleString() },
    { label: "Wagered", value: stats.wagered.toLocaleString() },
    { label: "Won", value: stats.won.toLocaleString() },
    {
      label: "RTP",
      value:
        stats.wagered > 0
          ? `${((stats.won / stats.wagered) * 100).toFixed(1)}%`
          : "—",
    },
    { label: "Biggest win", value: stats.biggestWin.toLocaleString() },
  ];

  return (
    <div className="flex flex-wrap gap-4 items-center justify-center text-xs font-mono text-slate-400">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <span className="uppercase tracking-wider text-[10px]">{label}</span>
          <span className="text-slate-200 font-bold text-sm">{value}</span>
        </div>
      ))}
    </div>
  );
}
