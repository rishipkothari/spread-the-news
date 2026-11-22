/** Minimal robots.txt support: groups for our UA token or "*", longest-match Allow/Disallow. */
interface Rule {
  allow: boolean;
  path: string;
}

export function parseRobots(txt: string, uaToken: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false;
      if (key === "disallow" && value === "") continue;
      current.rules.push({ allow: key === "allow", path: value });
    } else {
      lastWasAgent = false;
    }
  }
  const token = uaToken.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

function matches(path: string, pattern: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp(`^${body.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}${anchored ? "$" : ""}`);
  return re.test(path);
}

export function isAllowed(rules: Rule[], pathAndQuery: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (!matches(pathAndQuery, r.path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

const cache = new Map<string, Promise<Rule[]>>();

export function robotsFor(origin: string, userAgent: string, uaToken: string, timeoutMs: number): Promise<Rule[]> {
  let p = cache.get(origin);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`${origin}/robots.txt`, {
          headers: { "user-agent": userAgent },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "follow",
        });
        if (!res.ok) return []; // 4xx/5xx: treat as no restrictions
        return parseRobots(await res.text(), uaToken);
      } catch {
        return [];
      }
    })();
    cache.set(origin, p);
  }
  return p;
}

export async function checkRobots(url: string, userAgent: string, timeoutMs: number): Promise<boolean> {
  const u = new URL(url);
  const token = userAgent.split("/")[0];
  const rules = await robotsFor(u.origin, userAgent, token, timeoutMs);
  return isAllowed(rules, u.pathname + u.search);
}
