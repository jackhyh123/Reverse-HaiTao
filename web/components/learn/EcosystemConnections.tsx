"use client";

import { useEffect, useRef, useState } from "react";
import type { CrossRegionConnection } from "@/lib/ecosystem";

interface EcosystemConnectionsProps {
  connections: CrossRegionConnection[];
  sourceRef: HTMLDivElement | null;
  targetRefs: Map<string, HTMLDivElement>;
  sourceColor: string;
  visible: boolean;
}

/**
 * SVG overlay that draws animated dashed bezier curves from a hovered card
 * to connected cards in other regions.
 */
export default function EcosystemConnections({
  connections,
  sourceRef,
  targetRefs,
  sourceColor,
  visible,
}: EcosystemConnectionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  // Recalculate lines on scroll/resize
  useEffect(() => {
    if (!visible) return;

    const handleUpdate = () => setTick((t) => t + 1);
    window.addEventListener("scroll", handleUpdate, { passive: true });
    window.addEventListener("resize", handleUpdate);

    // Also update after a short delay (for layout settling)
    const timer = setInterval(handleUpdate, 200);

    return () => {
      window.removeEventListener("scroll", handleUpdate);
      window.removeEventListener("resize", handleUpdate);
      clearInterval(timer);
    };
  }, [visible]);

  if (!visible || !sourceRef || connections.length === 0) return null;

  // Get bounding rects
  const containerRect = containerRef.current?.getBoundingClientRect() ?? null;
  const sourceRect = sourceRef.getBoundingClientRect();

  const lines: Array<{
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
  }> = [];

  for (const conn of connections) {
    const targetEl = targetRefs.get(conn.targetNodeId);
    if (!targetEl) continue;
    const targetRect = targetEl.getBoundingClientRect();
    if (!containerRect) continue;

    // Calculate positions relative to the container
    const x1 = sourceRect.right - containerRect.left;
    const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
    const x2 = targetRect.left - containerRect.left;
    const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

    lines.push({
      key: `${conn.sourceNodeId}-${conn.targetNodeId}`,
      x1, y1, x2, y2,
      color: sourceColor,
    });
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-5"
      style={{ overflow: "visible" }}
    >
      <svg className="absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
        {lines.map((line) => {
          const dx = Math.abs(line.x2 - line.x1);
          const cpOffset = Math.min(dx * 0.5, 120);

          return (
            <path
              key={line.key}
              d={`M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke={line.color}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              strokeLinecap="round"
              opacity={0.5}
              style={{
                animation: "dash-flow 1s linear infinite",
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
