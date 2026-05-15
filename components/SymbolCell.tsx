"use client";

import Image from "next/image";
import type { SymbolId } from "@/lib/engine/symbols";
import { SYMBOLS } from "@/lib/engine/symbols";

interface Props {
  symbolId: SymbolId;
  size?: number;
  isWinning?: boolean;
  dimmed?: boolean;
}

export default function SymbolCell({ symbolId, size = 72, isWinning, dimmed }: Props) {
  const def = SYMBOLS[symbolId];

  return (
    <div
      className={[
        "relative flex items-center justify-center rounded-lg transition-all duration-300 select-none",
        isWinning ? "win-cell ring-2 ring-yellow-400" : "",
        dimmed ? "opacity-30" : "opacity-100",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
      title={def.label}
    >
      <Image
        src={`/symbols/${symbolId}.svg`}
        alt={def.label}
        width={size}
        height={size}
        priority={false}
        draggable={false}
      />
    </div>
  );
}
