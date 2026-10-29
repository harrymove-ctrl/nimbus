// The YAML a workstream file needs and no more: flat `key: value` lines and string lists. No dependency.
//   title: Inbox zero
//   goal: "Triage my inbox: reply drafts for the three that matter"
//   schedule: weekdays 08:00
//   tools:
//     - web_search
//     - write_artifact
export type Flat = Record<string, string | string[]>;

const RESERVED = /^(true|false|yes|no|on|off|null|~)$/i;
/** plain when it cannot be read back as anything else; otherwise a JSON string, which is valid double-quoted YAML */
const scalar = (s: string) => (/^[A-Za-z_][\w .,/()+-]*$/.test(s) && !/\s$/.test(s) && !RESERVED.test(s) ? s : JSON.stringify(s));

export function toYaml(obj: Record<string, string | string[] | undefined | null>, header?: string): string {
  const out: string[] = header ? header.split("\n").map((l) => `# ${l}`) : [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      out.push(v.length ? `${k}:` : `${k}: []`);
      for (const item of v) out.push(`  - ${scalar(item)}`);
    } else out.push(`${k}: ${scalar(v)}`);
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

export function parseYaml(text: string): Flat {
  const out: Flat = {};
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let list: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const where = `line ${i + 1}`;
    if (!line.trim() || line.trim().startsWith("#") || line.trim() === "---") continue;
    const item = /^\s+-\s+(.*)$/.exec(line) ?? /^-\s+(.*)$/.exec(line);
    if (item) {
      if (!list) throw new Error(`${where}: "- item" with no "key:" above it`);
      (out[list] as string[]).push(readScalar(item[1], where));
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*)\s*:(?:\s+(.*))?$/.exec(line);
    if (!kv) throw new Error(`${where}: expected "key: value" or "  - item", got ${JSON.stringify(line.trim().slice(0, 40))}`);
    const [, key, rest = ""] = kv;
    list = null;
    const v = rest.trim();
    if (!v || v.startsWith("#")) {
      out[key] = [];
      list = key;
    } else if (v.startsWith("[")) out[key] = flowList(v, where);
    else if (v === "|" || v === ">") {
      // a block of more-indented lines: kept as lines (|) or folded into one (>)
      const block: string[] = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || !lines[i + 1].trim())) block.push(lines[++i].trim());
      while (block.length && !block[block.length - 1]) block.pop();
      out[key] = v === "|" ? block.join("\n") : block.join(" ").replace(/\s+/g, " ");
    } else out[key] = readScalar(v, where);
  }
  return out;
}
