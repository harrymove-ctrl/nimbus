// The YAML a workstream file needs and no more: `key: value` lines, string lists, a list of maps (the crew) and
// multi-line blocks (the SKILL.md seed). No dependency. Templates under templates/ use the same format.
//   title: Inbox zero
//   goal: "Triage my inbox: reply drafts for the three that matter"
//   schedule: weekdays 08:00
//   tools:
//     - web_search
//     - write_artifact
//   roles:
//     - role: triager
//       tier: nano
//       tools: [write_artifact]
//       brief: Sort the inbox into needs me, can wait and noise.
//   skill: |
//     ## Inbox zero
//     1. Reply drafts only for people waiting on me.
export type YamlMap = Record<string, string | string[]>;
export type Flat = Record<string, string | string[] | YamlMap[]>;
type Value = string | string[] | YamlMap[] | YamlMap | undefined | null;

const RESERVED = /^(true|false|yes|no|on|off|null|~)$/i;
/** plain when it cannot be read back as anything else; otherwise a JSON string, which is valid double-quoted YAML */
const scalar = (s: string) => (/^[A-Za-z_][\w .,/()+-]*$/.test(s) && !/\s$/.test(s) && !RESERVED.test(s) ? s : JSON.stringify(s));
/** inside [a, b] a comma ends the item, so an item with one is quoted */
const flowItem = (s: string) => (s.includes(",") ? JSON.stringify(s) : scalar(s));

/** `key: value` at this indent: a multi-line string becomes a | block, a list in a map a [flow, list] */
function entry(key: string, v: string | string[], indent: string, out: string[], first = indent) {
  if (Array.isArray(v)) out.push(`${first}${key}: [${v.map(flowItem).join(", ")}]`);
  else if (v.includes("\n")) {
    out.push(`${first}${key}: |`);
    for (const l of v.replace(/\n+$/, "").split("\n")) out.push(l.trim() ? `${indent}  ${l.trimEnd()}` : "");
  } else out.push(`${first}${key}: ${scalar(v)}`);
}

export function toYaml(obj: Record<string, Value>, header?: string): string {
  const out: string[] = header ? header.split("\n").map((l) => `# ${l}`) : [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      out.push(v.length ? `${k}:` : `${k}: []`);
      for (const item of v) {
        if (typeof item === "string") out.push(`  - ${scalar(item)}`);
        else Object.entries(item).forEach(([ik, iv], j) => entry(ik, iv, "    ", out, j === 0 ? "  - " : "    "));
      }
    } else if (typeof v === "object") {
      out.push(`${k}:`);
      for (const [ik, iv] of Object.entries(v)) entry(ik, iv, "  ", out);
    } else entry(k, v, "", out);
  }
  return out.join("\n") + "\n";
}

function readScalar(raw: string, where: string): string {
  const v = raw.trim();
  if (v.startsWith('"')) {
    const m = /^"(?:[^"\\]|\\.)*"/.exec(v);
    if (!m) throw new Error(`${where}: unterminated "string"`);
    return JSON.parse(m[0]) as string;
  }
  if (v.startsWith("'")) {
    const m = /^'(?:[^']|'')*'/.exec(v);
    if (!m) throw new Error(`${where}: unterminated 'string'`);
    return m[0].slice(1, -1).replace(/''/g, "'");
  }
  return v.replace(/\s+#.*$/, "").trim();
}

function flowList(raw: string, where: string): string[] {
  const inner = raw.trim().replace(/\s+#.*$/, "");
  if (!inner.endsWith("]")) throw new Error(`${where}: a [list] must close on the same line`);
  const items = inner.slice(1, -1).match(/"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^,]+/g) ?? [];
  return items.map((i) => readScalar(i, where)).filter((i) => i !== "");
}

const KEY = /^([A-Za-z_][\w-]*)\s*:(?:\s+(.*))?$/;
const indentOf = (l: string) => l.length - l.trimStart().length;

export function parseYaml(text: string): Flat {
  const out: Flat = {};
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let list: string | null = null;
  /** the map a "- key: value" item opened; deeper `key: value` lines belong to it */
  let item: { map: YamlMap; indent: number } | null = null;
  let i = 0;

  /** the value after "key:" on line i: a scalar, a [flow list], or a | or > block of the lines indented deeper than `indent` */
  const value = (rest: string, indent: number, where: string): string | string[] => {
    const v = rest.trim();
    if (v.startsWith("[")) return flowList(v, where);
    if (v !== "|" && v !== ">") return readScalar(v, where);
    const block: string[] = [];
    while (i + 1 < lines.length && (!lines[i + 1].trim() || indentOf(lines[i + 1]) > indent)) block.push(lines[++i].trimEnd());
    while (block.length && !block[block.length - 1]) block.pop();
    // kept as lines with their indent relative to the block (|), or folded into one line (>)
    const cut = Math.min(...block.filter((l) => l.trim()).map(indentOf));
    return v === "|" ? block.map((l) => l.slice(cut)).join("\n") : block.map((l) => l.trim()).join(" ").replace(/\s+/g, " ").trim();
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const where = `line ${i + 1}`;
    if (!line.trim() || line.trim().startsWith("#") || line.trim() === "---") continue;
    const ind = indentOf(line);
    const dash = /^(\s*)-\s+(.*)$/.exec(line);
    if (item && ind > item.indent && !dash) {
      const kv = KEY.exec(line.trim());
      if (!kv) throw new Error(`${where}: expected "key: value" inside the list item, got ${JSON.stringify(line.trim().slice(0, 40))}`);
      item.map[kv[1]] = value(kv[2] ?? "", ind, where);
      continue;
    }
    item = null;
    if (dash) {
      if (!list) throw new Error(`${where}: "- item" with no "key:" above it`);
      const kv = /^["']/.test(dash[2]) ? null : KEY.exec(dash[2]);
      if (kv) {
        // "- role: tutor" opens a map; the lines under it at a deeper indent fill it
        const map: YamlMap = {};
        (out[list] as unknown[]).push(map);
        item = { map, indent: dash[1].length };
        map[kv[1]] = value(kv[2] ?? "", dash[1].length + 1, where);
      } else (out[list] as unknown[]).push(readScalar(dash[2], where));
      continue;
    }
    const kv = ind === 0 ? KEY.exec(line) : null;
    if (!kv) throw new Error(`${where}: expected "key: value" or "  - item", got ${JSON.stringify(line.trim().slice(0, 40))}`);
    const [, key, rest = ""] = kv;
    list = null;
    const v = rest.trim();
    if (!v || v.startsWith("#")) {
      out[key] = [];
      list = key;
    } else out[key] = value(v, 0, where);
  }
  return out;
}
