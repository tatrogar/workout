import { moveText, parseDuration, parseWeight } from "./tokens";
import type { CircuitMove, Exercise, Plan, Seconds, StrengthSet, Units } from "./types";

export type ParseError = { line: number; text: string; message: string };
export type ParseResult = { ok: true; plan: Plan } | { ok: false; errors: ParseError[] };

const TYPE_EXAMPLES: Record<string, string> = {
  strength: '"strength: 3x5 @ 185 lb, rest 120s" (no @ for bodyweight)',
  sets: '"sets: 135x8, 155x6, 175x4, rest 90s" (bw x8 for bodyweight)',
  intervals: '"intervals: 8 x 20s work / 10s rest"',
  hold: '"hold: 3 x 45s, rest 30s"',
  circuit: '"circuit: 3 rounds, rest 30s between moves, rest 60s between rounds" followed by lines like "- Plank 45s" or "- Push-ups 10 reps"',
  cardio: '"cardio: 20 min" or "cardio: 20 min, 2 mi"',
  other: '"other: 10 min"',
};
const TYPE_LINE_HINT = 'expected a line like "strength: 3x5 @ 185 lb"';

/** Normalize what Claude or a phone keyboard tends to produce. */
function clean(line: string): string {
  return line
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/(\d)\s*[×xX]\s*(?=\d|bw)/g, "$1x")
    .replace(/(\d\s*(?:lbs?|kgs?))\s*[×xX]\s*(?=\d)/gi, "$1x")
    .replace(/(^|[\s,:])(bw)\s*[×xX]\s*(?=\d)/gi, "$1bwx")
    .replace(/\s+/g, " ")
    .trim();
}

type Draft = { name: string; line: number; ex?: Exercise; typeLine?: number; failed?: boolean };

export function parsePlan(text: string, defaultUnits: Units): ParseResult {
  const errors: ParseError[] = [];
  const exercises: Exercise[] = [];
  let title: string | undefined;
  let planUnits: Units | null = null;
  let cur: Draft | null = null;

  const err = (line: number, raw: string, message: string) => errors.push({ line, text: raw.trim(), message });

  const noteUnits = (u: Units, line: number, raw: string): boolean => {
    if (planUnits === null) { planUnits = u; return true; }
    if (planUnits !== u) { err(line, raw, `use one unit per plan (this plan already uses ${planUnits})`); return false; }
    return true;
  };

  const closeCurrent = () => {
    if (!cur) return;
    if (cur.failed) { /* already reported */ }
    else if (!cur.ex) err(cur.line, `## ${cur.name}`, `"## ${cur.name}" has no type — ${TYPE_LINE_HINT} right after it`);
    else if (cur.ex.kind === "circuit" && cur.ex.moves.length === 0)
      err(cur.typeLine!, "circuit", `circuit has no moves — ${TYPE_EXAMPLES.circuit}`);
    else exercises.push(cur.ex);
    cur = null;
  };

  const lines = text.split(/\r?\n/);
  // If the plan is in a fenced block (``` or ~~~), read only inside the first one; chat text around it is ignored.
  const isFence = (l: string) => /^(```|~~~)[\w-]*$/.test(clean(l));
  const open = lines.findIndex(isFence);
  let from = 0;
  let to = lines.length;
  if (open >= 0) {
    from = open + 1;
    const close = lines.findIndex((l, i) => i > open && isFence(l));
    if (close >= 0) to = close;
  }
  lines.forEach((raw, i) => {
    if (i < from || i >= to) return;
    const lineNo = i + 1;
    const line = clean(raw);
    if (!line) return;

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^##\s+(.+)$/))) {
      closeCurrent();
      cur = { name: m[1].trim(), line: lineNo };
      return;
    }
    if ((m = line.match(/^#\s+(.+)$/))) {
      if (title === undefined && exercises.length === 0 && !cur) title = m[1].trim();
      else err(lineNo, raw, 'a "# Title" line can only appear once, at the top');
      return;
    }
    if (!cur) {
      err(lineNo, raw, 'expected "## Exercise name" before this line');
      return;
    }
    const draft: Draft = cur;

    if ((m = line.match(/^note:\s*(.+)$/i))) {
      if (!draft.ex) err(lineNo, raw, `put the type line first — ${TYPE_LINE_HINT}`);
      else draft.ex.note = m[1].trim();
      return;
    }
    if ((m = line.match(/^-\s*(.+)$/))) {
      if (draft.ex?.kind !== "circuit") { err(lineNo, raw, 'a "- move" line only belongs under a "circuit:" line'); return; }
      const move = parseMove(m[1]);
      if (!move) err(lineNo, raw, 'expected a move like "- Plank 45s" or "- Push-ups 10 reps"');
      else draft.ex.moves.push(move);
      return;
    }
    if ((m = line.match(/^([a-z]+):\s*(.*)$/i))) {
      const kind = m[1].toLowerCase();
      if (!(kind in TYPE_EXAMPLES)) { err(lineNo, raw, `unknown type "${m[1]}" — use strength, sets, intervals, hold, circuit, cardio or other`); return; }
      if (draft.ex) { err(lineNo, raw, `"${draft.name}" already has a type line — start a new "## name" for another exercise`); return; }
      const r = parseTypeLine(kind, m[2], draft.name);
      if ("error" in r) { err(lineNo, raw, `expected like ${TYPE_EXAMPLES[kind]}`); draft.failed = true; return; }
      if (r.units && !noteUnits(r.units, lineNo, raw)) { draft.failed = true; return; }
      draft.ex = r.ex;
      draft.typeLine = lineNo;
      return;
    }
    err(lineNo, raw, draft.ex ? 'unexpected line — expected "note: ...", "- move", or the next "## name"' : TYPE_LINE_HINT);
  });
  closeCurrent();

  if (errors.length === 0 && exercises.length === 0) errors.push({ line: 1, text: "", message: 'no exercises found — start each one with "## Exercise name"' });
  if (errors.length) return { ok: false, errors: errors.sort((a, b) => a.line - b.line) };
  const plan: Plan = { units: planUnits ?? defaultUnits, exercises };
  if (title !== undefined) plan.title = title;
  return { ok: true, plan };
}

function parseMove(raw: string): CircuitMove | null {
  const sideRe = /\s*(?:\/\s*(?:side|each)|\s(?:each|per) side)$/i;
  const side = sideRe.test(raw) ? { perSide: true } : {};
  const s = raw.replace(sideRe, "").trim();
  let m = s.match(/^(.+?)\s+(?:x\s*(\d+)|(\d+)\s*reps?)$/i);
  if (m) return { name: m[1], reps: Number(m[2] ?? m[3]), ...side };
  m = s.match(/^(.+?)\s+(\d+(?:\.\d+)?\s*[a-z]+|\d+:\d\d)$/i);
  if (m) {
    const sec = parseDuration(m[2]);
    if (sec) return { name: m[1], sec, ...side };
  }
  return null;
}

/** Split "a, b, rest 90s" into parts and an optional trailing rest. */
function splitRest(body: string): { parts: string[]; restSec?: Seconds; moveRestSec?: Seconds; bad?: true } {
  const out: { parts: string[]; restSec?: Seconds; moveRestSec?: Seconds; bad?: true } = { parts: [] };
  for (const p of body.split(",").map((x) => x.trim()).filter(Boolean)) {
    const m = p.match(/^rest\s+(.+?)(?:\s+between\s+(moves|rounds))?$/i);
    if (!m) { out.parts.push(p); continue; }
    const sec = parseDuration(m[1]);
    if (sec === null) out.bad = true;
    else if (m[2]?.toLowerCase() === "moves") out.moveRestSec = sec;
    else out.restSec = sec;
  }
  return out;
}

type TypeResult = { ex: Exercise; units?: Units } | { error: true };

const SIDE_SUFFIX = /\s*(?:\/\s*(?:side|each)|\s(?:each|per)\s+side)$/i;
/** "10/side", "10 each side" → { text: "10", perSide: true } */
function stripSide(s: string): { text: string; perSide: boolean } {
  return SIDE_SUFFIX.test(s) ? { text: s.replace(SIDE_SUFFIX, "").trim(), perSide: true } : { text: s, perSide: false };
}

function parseTypeLine(kind: string, body: string, name: string): TypeResult {
  const { parts, restSec, moveRestSec, bad } = splitRest(body);
  if (bad || parts.length === 0) return { error: true };
  if (moveRestSec !== undefined && kind !== "circuit") return { error: true };
  const rest = restSec !== undefined ? { restSec } : {};
  let m: RegExpMatchArray | null;

  switch (kind) {
    case "strength": {
      if (parts.length !== 1) return { error: true };
      m = parts[0].match(/^(\d+)x(\d+(?:\s*\/\s*(?:side|each)|\s+(?:each|per)\s+side)?)(?:\s*@\s*(.+))?$/i);
      if (!m) return { error: true };
      const count = Number(m[1]);
      const repsSide = stripSide(m[2]);
      const reps = Number(repsSide.text);
      let weight: number | undefined;
      let units: Units | undefined;
      if (m[3]) {
        const w = parseWeight(m[3], "lb");
        if (!w) return { error: true };
        weight = w.value;
        if (/[a-z]/i.test(m[3])) units = w.units;
      }
      if (count < 1 || reps < 1) return { error: true };
      const sets: StrengthSet[] = Array.from({ length: count }, () => (weight === undefined ? { reps } : { weight, reps }));
      return { ex: { kind: "strength", name, ...rest, sets, ...(repsSide.perSide ? { perSide: true } : {}) }, units };
    }
    case "sets": {
      const sets: StrengthSet[] = [];
      let units: Units | undefined;
      const sides = new Set<boolean>();
      for (const raw of parts) {
        const sp = stripSide(raw);
        sides.add(sp.perSide);
        const p = sp.text;
        m = p.match(/^(.+?)x(\d+)$/i);
        if (!m) return { error: true };
        const reps = Number(m[2]);
        if (/^bw$/i.test(m[1].trim())) { sets.push({ reps }); continue; }
        const w = parseWeight(m[1], "lb");
        if (!w) return { error: true };
        if (/[a-z]/i.test(m[1])) {
          if (units && units !== w.units) return { error: true };
          units = w.units;
        }
        sets.push({ weight: w.value, reps });
      }
      if (sides.size > 1) return { error: true }; // every set per-side, or none
      return { ex: { kind: "strength", name, ...rest, sets, ...(sides.has(true) ? { perSide: true } : {}) }, units };
    }
    case "intervals": {
      if (parts.length !== 1 || restSec !== undefined) return { error: true };
      m = parts[0].match(/^(\d+)\s*x\s*(.+?)\s*(?:work|on)\s*\/\s*(.+?)\s*(?:rest|off)$/i);
      if (!m) return { error: true };
      const workSec = parseDuration(m[2]);
      const rs = parseDuration(m[3]);
      if (!workSec || rs === null) return { error: true };
      return { ex: { kind: "intervals", name, rounds: Number(m[1]), workSec, restSec: rs } };
    }
    case "hold": {
      if (parts.length !== 1) return { error: true };
      m = parts[0].match(/^(\d+)\s*x\s*(.+)$/i);
      const hs = m ? stripSide(m[2]) : null;
      const holdSec = hs ? parseDuration(hs.text) : null;
      if (!m || !hs || !holdSec) return { error: true };
      return { ex: { kind: "hold", name, sets: Number(m[1]), holdSec, ...rest, ...(hs.perSide ? { perSide: true } : {}) } };
    }
    case "circuit": {
      if (parts.length !== 1) return { error: true };
      m = parts[0].match(/^(\d+)\s*rounds?$/i);
      if (!m) return { error: true };
      return { ex: { kind: "circuit", name, rounds: Number(m[1]), ...rest, ...(moveRestSec !== undefined ? { moveRestSec } : {}), moves: [] } };
    }
    case "cardio": {
      if (restSec !== undefined || parts.length > 2) return { error: true };
      const durationSec = parseDuration(parts[0]);
      if (!durationSec) return { error: true };
      const ex: Exercise = { kind: "cardio", name, durationSec };
      if (parts[1]) {
        m = parts[1].match(/^(\d+(?:\.\d+)?)\s*(mi|miles?|km|kms|kilometers?|kilometres?)$/i);
        if (!m) return { error: true };
        ex.distance = Number(m[1]);
        ex.distanceUnit = m[2].toLowerCase().startsWith("k") ? "km" : "mi";
      }
      return { ex };
    }
    case "other": {
      if (restSec !== undefined || parts.length !== 1) return { error: true };
      const durationSec = parseDuration(parts[0]);
      if (!durationSec) return { error: true };
      return { ex: { kind: "other", name, durationSec } };
    }
  }
  return { error: true };
}

/** Inverse of parsePlan, for saving edited plans as templates. */
export function planToText(plan: Plan): string {
  const out: string[] = [];
  if (plan.title) out.push(`# ${plan.title}`, "");
  const u = plan.units;
  const rest = (s?: Seconds) => (s !== undefined ? `, rest ${s}s` : "");
  for (const ex of plan.exercises) {
    out.push(`## ${ex.name}`);
    switch (ex.kind) {
      case "strength": {
        const first = ex.sets[0];
        const same = ex.sets.every((s) => s.reps === first.reps && s.weight === first.weight);
        const side = ex.perSide ? "/side" : "";
        if (same) out.push(`strength: ${ex.sets.length}x${first.reps}${side}${first.weight !== undefined ? ` @ ${first.weight} ${u}` : ""}${rest(ex.restSec)}`);
        else out.push(`sets: ${ex.sets.map((s) => (s.weight !== undefined ? `${s.weight} ${u}x${s.reps}${side}` : `bw x${s.reps}${side}`)).join(", ")}${rest(ex.restSec)}`);
        break;
      }
      case "intervals": out.push(`intervals: ${ex.rounds} x ${ex.workSec}s work / ${ex.restSec}s rest`); break;
      case "hold": out.push(`hold: ${ex.sets} x ${ex.holdSec}s${ex.perSide ? "/side" : ""}${rest(ex.restSec)}`); break;
      case "circuit":
        out.push(`circuit: ${ex.rounds} rounds${ex.moveRestSec !== undefined ? `, rest ${ex.moveRestSec}s between moves` : ""}${ex.restSec !== undefined ? `, rest ${ex.restSec}s between rounds` : ""}`);
        for (const mv of ex.moves) out.push(`- ${moveText(mv)}`);
        break;
      case "cardio": out.push(`cardio: ${ex.durationSec}s${ex.distance !== undefined ? `, ${ex.distance} ${ex.distanceUnit ?? "mi"}` : ""}`); break;
      case "other": out.push(`other: ${ex.durationSec}s`); break;
    }
    if (ex.note) out.push(`note: ${ex.note}`);
    out.push("");
  }
  return out.join("\n");
}

/** Rough check before parsing: does this text even try to be an app plan (a "## name" and a type line)? */
export function looksLikePlan(text: string): boolean {
  const lines = text.split(/\r?\n/).map(clean);
  return lines.some((l) => /^##\s+\S/.test(l)) && lines.some((l) => /^(strength|sets|intervals|hold|circuit|cardio|other):/i.test(l));
}

/** A message with several fenced blocks (a week of workouts) → one plan text per block. Otherwise the text as is. */
export function splitPlans(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const isFence = (l: string) => /^(```|~~~)[\w-]*$/.test(clean(l));
  const blocks: string[] = [];
  let open = -1;
  lines.forEach((l, i) => {
    if (!isFence(l)) return;
    if (open < 0) { open = i; return; }
    const body = lines.slice(open + 1, i).join("\n").trim();
    if (body) blocks.push(body);
    open = -1;
  });
  return blocks.length >= 2 ? blocks : [text];
}
