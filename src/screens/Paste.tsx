import { useState } from "react";
import { Button, Card, Title } from "../components/ui";
import { looksLikePlan, parsePlan, type ParseResult } from "../plan/parse";
import { describePlanned } from "../export/describe";
import { unlockAudio } from "../timer/cues";
import { navigate } from "../router";
import { useData } from "../store/data";
import { useSettings } from "../store/settings";
import { createWorkout, newId } from "../workout/session";

const REWRITE_ASK = "Rewrite this workout in the workout app format from my instructions, in one code block in the chat, not an artifact.";
const DRAFT_KEY = "workout.pasteDraft";
const readDraft = () => { try { return localStorage.getItem(DRAFT_KEY) ?? ""; } catch { return ""; } };
const saveDraft = (t: string) => { try { localStorage.setItem(DRAFT_KEY, t); } catch { /* ignore */ } };

export function startFromText(text: string, units: "lb" | "kg"): boolean {
  const r = parsePlan(text, units);
  if (!r.ok) return false;
  const { active, startWorkout } = useData.getState();
  if (active && !window.confirm(`Replace the unfinished workout "${active.title}"?`)) return false;
  unlockAudio();
  startWorkout(createWorkout(r.plan, text, new Date()));
  navigate("/workout");
  return true;
}

export function Paste() {
  const units = useSettings((s) => s.units);
  const saveTemplate = useData((s) => s.saveTemplate);
  const [text, setText] = useState(readDraft);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [asked, setAsked] = useState(false);

  const parse = () => { setResult(parsePlan(text, units)); setSaved(false); };

  return (
    <div className="space-y-4">
      <Title>Paste plan</Title>
      <textarea className="h-64 w-full rounded-xl bg-slate-800 p-3 font-mono text-sm" placeholder={"Paste the plan Claude wrote.\n\n## Squat\nstrength: 3x5 @ 185 lb, rest 120s"}
        value={text} onChange={(e) => { setText(e.target.value); saveDraft(e.target.value); setResult(null); }} />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={async () => { try { const t = await navigator.clipboard.readText(); setText(t); saveDraft(t); setResult(parsePlan(t, units)); } catch { /* no permission */ } }}>Paste from clipboard</Button>
        <Button variant="primary" onClick={parse} disabled={!text.trim()}>Check plan</Button>
      </div>

      {result && !result.ok && !looksLikePlan(text) && (
        <Card className="border-rose-700">
          <h2 className="mb-2 font-semibold text-rose-300">This isn't in the workout-app format</h2>
          <p className="mb-3 text-sm">It reads like a normal message, not a plan the app can run. Ask Claude to rewrite it, then paste the code block it sends back.</p>
          <Button className="w-full" onClick={async () => { try { await navigator.clipboard.writeText(REWRITE_ASK); setAsked(true); } catch { /* no permission */ } }}>
            {asked ? "Copied ✓" : "Copy a message asking Claude to rewrite it"}
          </Button>
          <p className="mt-2 text-xs text-[var(--muted)]">“{REWRITE_ASK}”</p>
        </Card>
      )}

      {result && !result.ok && looksLikePlan(text) && (
        <Card className="border-rose-700" >
          <h2 className="mb-2 font-semibold text-rose-300">Fix {result.errors.length === 1 ? "this line" : `these ${result.errors.length} lines`}</h2>
          <ul className="space-y-2 text-sm" data-testid="parse-errors">
            {result.errors.map((e, i) => (
              <li key={i}><span className="font-semibold">Line {e.line}:</span> <code className="text-amber-200">{e.text || "(empty)"}</code><br />{e.message}</li>
            ))}
          </ul>
        </Card>
      )}

      {result?.ok && (
        <Card>
          <h2 className="mb-2 text-xl font-semibold">{result.plan.title ?? "Workout"}</h2>
          <ul className="mb-4 space-y-1">
            {result.plan.exercises.map((ex, i) => (
              <li key={i} className="flex justify-between gap-3"><span>{ex.name}</span><span className="text-right text-sm text-[var(--muted)]">{describePlanned(ex)}</span></li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => {
              const name = window.prompt("Template name", result.plan.title ?? "Workout");
              if (!name) return;
              saveTemplate({ id: newId(), name, planText: text, updatedAt: new Date().toISOString() });
              setSaved(true);
            }}>{saved ? "Saved ✓" : "Save as template"}</Button>
            <Button variant="primary" onClick={() => { if (startFromText(text, units)) saveDraft(""); }}>Start workout</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
