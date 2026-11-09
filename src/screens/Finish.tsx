import { useState } from "react";
import { Button, Card, LinkButton, Title } from "../components/ui";
import { describeLog } from "../export/describe";
import { navigate } from "../router";
import { useData } from "../store/data";
import { exerciseStatus } from "../workout/session";

export function Finish() {
  const { active, finishActive, discardActive } = useData();
  const [notes, setNotes] = useState(active?.notes ?? "");
  if (!active) return <div className="pt-10 text-center"><p className="mb-4">Nothing to finish.</p><LinkButton href="#/">Start</LinkButton></div>;
  const logs = active.exercises.map((l) => ({ ...l, status: exerciseStatus(l) }));
  const doneCount = logs.filter((l) => l.status === "done").length;
  return (
    <div className="space-y-4">
      <Title>Finish</Title>
      <Card>
        <h2 className="text-xl font-semibold">{active.title}</h2>
        <p className="mb-3 text-[var(--muted)]">{doneCount} of {logs.length} exercises done · {Math.round((Date.now() - Date.parse(active.startedAt)) / 60000)} min</p>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{logs.flatMap(describeLog).join("\n")}</pre>
      </Card>
      <textarea className="min-h-[5rem] w-full rounded-xl bg-slate-800 p-3" placeholder="How did it go? Sleep, energy, anything that hurt."
        value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => navigate("/workout")}>‹ Back</Button>
        <Button variant="primary" onClick={() => { const id = finishActive(new Date(), notes.trim() || undefined); navigate(id ? `/history/${id}` : "/history"); }}>Save workout</Button>
      </div>
      <Button variant="ghost" className="w-full text-rose-300" onClick={() => { if (window.confirm("Throw this workout away? It won't be saved.")) { discardActive(); navigate("/"); } }}>Discard workout</Button>
    </div>
  );
}
