import { useState } from "react";
import { Button, Card, LinkButton, Title } from "../components/ui";
import { parsePlan, type ParseError } from "../plan/parse";
import { navigate } from "../router";
import { useData } from "../store/data";
import { useSettings } from "../store/settings";
import { newId } from "../workout/session";
import { startFromText } from "./Paste";

export function Templates() {
  const { templates, saveTemplate } = useData();
  const units = useSettings((s) => s.units);
  return (
    <div className="space-y-3">
      <Title right={<LinkButton href="#/templates/new" variant="primary">New</LinkButton>}>Templates</Title>
      {templates.length === 0 && <p className="text-[var(--muted)]">Save a pasted plan as a template, or make one here with New.</p>}
      {templates.map((t) => (
        <Card key={t.id}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-lg font-semibold">{t.name}</span>
            <span className="text-sm text-[var(--muted)]">{t.planText.split("\n").filter((l) => l.trim().startsWith("## ")).length} exercises</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Button variant="primary" className="col-span-2" onClick={() => { if (!startFromText(t.planText, units)) navigate(`/templates/${t.id}`); }}>Start</Button>
            <LinkButton href={`#/templates/${t.id}`}>Edit</LinkButton>
            <Button onClick={() => saveTemplate({ ...t, id: newId(), name: `${t.name} (copy)`, updatedAt: new Date().toISOString() })}>Copy</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TemplateEditor({ id }: { id: string }) {
  const { templates, saveTemplate, deleteTemplate } = useData();
  const units = useSettings((s) => s.units);
  const existing = templates.find((t) => t.id === id);
  const [name, setName] = useState(existing?.name ?? "");
  const [text, setText] = useState(existing?.planText ?? "# \n\n## \nstrength: 3x5 @ 135 lb, rest 90s\n");
  const [errors, setErrors] = useState<ParseError[]>([]);

  const save = () => {
    const r = parsePlan(text, units);
    if (!r.ok) { setErrors(r.errors); return; }
    saveTemplate({ id: existing?.id ?? newId(), name: name.trim() || r.plan.title || "Workout", planText: text, updatedAt: new Date().toISOString() });
    navigate("/templates");
  };

  return (
    <div className="space-y-3">
      <Title right={<a href="#/templates" className="text-sky-400">‹ Templates</a>}>{existing ? "Edit template" : "New template"}</Title>
      <input className="min-h-touch w-full rounded-xl bg-slate-800 px-3 text-lg" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Template name" />
      <textarea className="h-80 w-full rounded-xl bg-slate-800 p-3 font-mono text-sm" value={text} onChange={(e) => { setText(e.target.value); setErrors([]); }} aria-label="Plan text" />
      {errors.length > 0 && (
        <Card className="border-rose-700">
          <ul className="space-y-2 text-sm">{errors.map((e, i) => <li key={i}><b>Line {e.line}:</b> <code className="text-amber-200">{e.text}</code><br />{e.message}</li>)}</ul>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        {existing ? <Button variant="danger" onClick={() => { if (window.confirm("Delete this template?")) { deleteTemplate(existing.id); navigate("/templates"); } }}>Delete</Button> : <span />}
        <Button variant="primary" onClick={save}>Save</Button>
      </div>
    </div>
  );
}
