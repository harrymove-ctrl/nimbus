"use client";

import { useTween } from "@/hooks/use-tween";

/** Counts up with tabular digits (cost pill 300 ms, summary tiles 600 ms; ease-out). */
export function CountUp({ value, format, ms = 600 }: { value: number; format: (n: number) => string; ms?: number }) {
  const v = useTween(value, ms, "out");
  return <span className="tabular-nums">{format(v)}</span>;
}
