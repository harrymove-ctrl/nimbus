"use client";

// A small Markdown renderer for what the crew writes: reports in the transcript, handoff notes, message drafts and doc
// artifacts. It covers the shapes the real models produce (headings, rules, bullets with nested lines, numbered items,
// tables, fenced code, quotes, bold, italic, inline code, links) without a dependency and without ever emitting HTML.
// Sizes are relative to the wrapper's font size, so the same component reads right at 13 px and at 15 px.
import { Fragment, type ReactNode } from "react";
import { cx } from "./ui";

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|(?<![\w*])\*(?!\s)[^*\n]+?(?<!\s)\*(?![\w*])|(?<![\w_])_(?!\s)[^_\n]+?(?<!\s)_(?![\w_]))/g;

/** Bold, inline code, links and italics inside one line of text. */
export function inline(s: string): ReactNode[] {
  return s.split(INLINE).map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**"))
      return (
        <strong key={i} className="font-extrabold text-neutral-50">
          {inline(p.slice(2, -2))}
        </strong>
      );
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={i} className="rounded bg-white/10 px-1 font-mono text-[0.9em]">
          {p.slice(1, -1)}
        </code>
      );
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
    if (link) {
      const safe = /^(https?:\/\/|mailto:|\/|#)/i.test(link[2]);
      return safe ? (
        <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-2 hover:decoration-white/70">
          {inline(link[1])}
        </a>
      ) : (
        <Fragment key={i}>{link[1]}</Fragment>
      );
    }
    if ((p.startsWith("*") && p.endsWith("*")) || (p.startsWith("_") && p.endsWith("_")))
      return (
        <em key={i} className="italic">
          {inline(p.slice(1, -1))}
        </em>
      );
    return <Fragment key={i}>{p}</Fragment>;
  });
}

const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const isRule = (l: string) => /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);
const isTableRule = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

type Block = { kind: "table"; lines: string[] } | { kind: "code"; lines: string[]; lang: string } | { kind: "line"; text: string };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  let code: { kind: "code"; lines: string[]; lang: string } | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (code) {
      if (/^\s*```/.test(raw)) {
        out.push(code);
        code = null;
      } else code.lines.push(raw);
      continue;
    }
    const fence = /^\s*```\s*(\w*)/.exec(raw);
    if (fence) {
      code = { kind: "code", lines: [], lang: fence[1] };
      continue;
    }
    const last = out[out.length - 1];
    if (raw.trim().startsWith("|")) {
      if (last?.kind === "table") last.lines.push(raw);
      else out.push({ kind: "table", lines: [raw] });
    } else out.push({ kind: "line", text: raw });
  }
  if (code) out.push(code);
  return out;
}

/**
 * Renders Markdown text as React. `className` sets the wrapper's text size and colour; everything inside scales from it.
 * `compact` tightens the vertical rhythm for transcript cards.
 */
export function Markdown({ text, className, compact = false }: { text: string; className?: string; compact?: boolean }) {
  const bs = blocks(text);
  const gap = compact ? "gap-1" : "gap-2";
  return (
    <div className={cx("flex min-w-0 flex-col [overflow-wrap:anywhere]", gap, className)}>
      {bs.map((b, i) => {
        if (b.kind === "code")
          return (
            <pre key={i} className="my-1 overflow-x-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[0.86em]/[1.5] text-neutral-200">
              <code>{b.lines.join("\n")}</code>
            </pre>
          );
        if (b.kind === "table") {
          const [head, maybeRule, ...rest] = b.lines;
          const rows = maybeRule !== undefined && !isTableRule(maybeRule) ? [maybeRule, ...rest] : rest;
          return (
            <div key={i} className="my-1 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-start text-[0.87em]/[1.45]">
                <thead className="bg-white/5 text-neutral-300">
                  <tr>
                    {cells(head).map((c, j) => (
                      <th key={j} className="px-2.5 py-1.5 text-start font-extrabold">
                        {inline(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, j) => (
                    <tr key={j} className="border-t border-white/8">
                      {cells(r).map((c, k) => (
                        <td key={k} className="px-2.5 py-1.5 align-top">
                          {inline(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const l = b.text;
        const t = l.trim();
        if (t === "") return null;
        if (isRule(l)) return <hr key={i} className="my-2 border-white/10" />;
        const h = /^(#{1,6})\s+(.*)$/.exec(t);
        if (h) {
          const depth = h[1].length;
          const body = inline(h[2].replace(/\s+#+\s*$/, ""));
          if (depth === 1)
            return (
              <h2 key={i} className="mt-1 text-[1.3em]/[1.3] font-extrabold text-neutral-50">
                {body}
              </h2>
            );
          if (depth === 2)
            return (
              <h3 key={i} className="mt-2 text-[0.87em] font-extrabold uppercase tracking-wider text-neutral-400">
                {body}
              </h3>
            );
          return (
            <h4 key={i} className="mt-1.5 text-[1em] font-extrabold text-neutral-50">
              {body}
            </h4>
          );
        }
        if (t.startsWith("> "))
          return (
            <p key={i} className="border-s-2 border-white/15 ps-3 text-neutral-300">
              {inline(t.slice(2))}
            </p>
          );
        // nesting: every two leading spaces (or a tab) is one level
        const indent = Math.floor((/^[ \t]*/.exec(l)?.[0].replace(/\t/g, "  ").length ?? 0) / 2);
        const pad = indent === 0 ? "" : indent === 1 ? "ms-4" : indent === 2 ? "ms-8" : "ms-12";
        const num = /^(\d+)[.)]\s+(.*)$/.exec(t);
        if (num)
          return (
            <p key={i} className={cx("flex gap-2", pad)}>
              <span className="w-[1.6em] shrink-0 text-end tabular-nums text-neutral-400">{num[1]}.</span>
              <span className="min-w-0 flex-1">{inline(num[2])}</span>
            </p>
          );
        const bullet = /^[-*+]\s+(.*)$/.exec(t);
        if (bullet)
          return (
            <p key={i} className={cx("flex gap-2", pad)}>
              <span className="w-[1em] shrink-0 text-center text-neutral-400">{indent > 0 ? "◦" : "•"}</span>
              <span className="min-w-0 flex-1">{inline(bullet[1])}</span>
            </p>
          );
        const check = /^\[( |x|X)\]\s+(.*)$/.exec(t);
        if (check)
          return (
            <p key={i} className={cx("flex gap-2", pad)}>
              <span className="w-[1em] shrink-0 text-center text-neutral-400">{check[1] === " " ? "☐" : "☑"}</span>
              <span className="min-w-0 flex-1">{inline(check[2])}</span>
            </p>
          );
        return (
          <p key={i} className={pad}>
            {inline(t)}
          </p>
        );
      })}
    </div>
  );
}
