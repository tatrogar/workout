import { describe, expect, it } from "vitest";
import { embedUrl, parseYouTube } from "../src/videos/youtube";
import { allExerciseNames, planNames, videoFor } from "../src/videos/library";
import { createDataStore, type KV } from "../src/store/data";
import { toMarkdown } from "../src/export/markdown";
import { parseExport } from "../src/export/importFile";
import { parsePlan } from "../src/plan/parse";
import { createWorkout } from "../src/workout/session";
import { legDay } from "./fixtures/workouts";

function memory(): KV {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}
const ID = "dQw4w9WgXcQ";

describe("reading YouTube links", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, undefined],
    [`https://youtube.com/watch?v=${ID}&t=95`, 95],
    [`https://m.youtube.com/watch?v=${ID}&feature=share&t=1m35s`, 95],
    [`https://youtu.be/${ID}`, undefined],
    [`https://youtu.be/${ID}?t=95`, 95],
    [`https://youtu.be/${ID}?si=abc123&t=2h1m5s`, 7265],
    [`https://www.youtube.com/shorts/${ID}`, undefined],
    [`https://www.youtube.com/watch?v=${ID}#t=30`, 30],
    [`https://www.youtube.com/embed/${ID}?start=12`, 12],
    [`youtube.com/watch?v=${ID}`, undefined],
    [`  https://youtu.be/${ID}  `, undefined],
  ])("%s", (url, start) => {
    expect(parseYouTube(url)).toEqual(start === undefined ? { id: ID } : { id: ID, start });
  });
  it.each([
    "https://vimeo.com/12345",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UC123",
    "not a link",
    "",
    "https://evil.example.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
  ])("rejects %s", (url) => expect(parseYouTube(url)).toBeNull());

  it("embeds via the privacy-enhanced domain with the start time", () => {
    expect(embedUrl({ id: ID, start: 95 })).toBe(`https://www.youtube-nocookie.com/embed/${ID}?start=95&playsinline=1&rel=0`);
    expect(embedUrl({ id: ID })).toBe(`https://www.youtube-nocookie.com/embed/${ID}?playsinline=1&rel=0`);
  });
});

describe("the video library", () => {
  it("matches by name ignoring case and spaces, and through merges", () => {
    const videos = { squat: { id: ID, start: 10 } };
    expect(videoFor(videos, "  SQUAT ", {})).toEqual({ id: ID, start: 10 });
    expect(videoFor(videos, "Back squat", { "back squat": "squat" })).toEqual({ id: ID, start: 10 });
    expect(videoFor(videos, "Deadlift", {})).toBeNull();
  });

  it("lists every name the app knows, including circuit moves, once each, alphabetically", () => {
    const text = "## Squat\nstrength: 3x5\n## Core\ncircuit: 1 round\n- Plank 30s\n- Side plank 20s/side";
    const r = parsePlan(text, "lb");
    if (!r.ok) throw new Error();
    const active = createWorkout(r.plan, text, new Date(), "a");
    const names = allExerciseNames({
      workouts: [legDay()], active,
      templates: [{ id: "t", name: "T", planText: "## Bench press\nstrength: 3x5", updatedAt: "" }],
      upNext: [{ id: "u", title: "U", planText: "## Row\ncardio: 10 min" }],
      videos: { "pull-up": { id: ID } },
    }, {});
    expect(names.map((n) => n.display)).toEqual([
      "Bench press", "Core", "Core circuit", "Dead bug", "Easy run", "Hip mobility", "Plank", "Pull-up", "Row", "Side plank", "Squat", "Tabata",
    ]);
    expect(names.find((n) => n.key === "pull-up")).toEqual({ key: "pull-up", display: "Pull-up" });
  });

  it("merged names list once, under the name they were merged into", () => {
    const names = allExerciseNames({ workouts: [legDay()], active: null, templates: [{ id: "t", name: "T", planText: "## Back squat\nstrength: 3x5", updatedAt: "" }], upNext: [], videos: {} }, { "back squat": "squat" });
    expect(names.filter((n) => n.key === "squat")).toHaveLength(1);
    expect(names.some((n) => n.key === "back squat")).toBe(false);
  });

  it("the store saves, replaces and removes a video by name", () => {
    const s = createDataStore(memory());
    expect(s.getState().setVideo("Squat", `https://youtu.be/${ID}?t=5`)).toBe(true);
    expect(s.getState().videos).toEqual({ squat: { id: ID, start: 5 } });
    expect(s.getState().setVideo("squat", "https://vimeo.com/1")).toBe(false);
    expect(s.getState().videos.squat).toEqual({ id: ID, start: 5 });
    s.getState().removeVideo(" Squat");
    expect(s.getState().videos).toEqual({});
  });
});

describe("backups", () => {
  it("export everything carries the videos and import brings them back", () => {
    const md = toMarkdown([legDay()], {}, "lb", new Date(), { squat: { id: ID, start: 5 } });
    const r = parseExport(md);
    expect(r.ok && r.videos).toEqual({ squat: { id: ID, start: 5 } });
  });
  it("leaving videos out keeps them out of the file", () => {
    expect(toMarkdown([legDay()], {}, "lb", new Date())).not.toContain('"videos"');
  });
  it("import ignores malformed video entries", () => {
    const r = parseExport('```json\n{"formatVersion":1,"workouts":[],"videos":{"squat":{"id":"bad"},"row":{"id":"' + ID + '","start":"x"},"lunge":{"id":"' + ID + '"}}}\n```');
    expect(r.ok && r.videos).toEqual({ lunge: { id: ID } });
  });
});

import { parseHash } from "../src/router";
describe("route", () => {
  it("#/exercises exists", () => expect(parseHash("#/exercises").path).toBe("/exercises"));
});

describe("hiding exercises from the list", () => {
  it("hide removes it and its video; unhide brings it back", () => {
    const s = createDataStore(memory());
    s.getState().setVideo("Cooldown", `https://youtu.be/${ID}`);
    s.getState().hideExercise(" COOLDOWN ");
    expect(s.getState().hiddenExercises).toEqual(["cooldown"]);
    expect(s.getState().videos).toEqual({});
    s.getState().hideExercise("cooldown");
    expect(s.getState().hiddenExercises).toEqual(["cooldown"]);
    s.getState().unhideExercise("Cooldown");
    expect(s.getState().hiddenExercises).toEqual([]);
  });
  it("hidden names persist across restarts", () => {
    const kv = memory();
    createDataStore(kv).getState().hideExercise("Cooldown");
    expect(createDataStore(kv).getState().hiddenExercises).toEqual(["cooldown"]);
  });
  it("full backups carry hidden names and import merges them", () => {
    const md = toMarkdown([legDay()], {}, "lb", new Date(), {}, ["cooldown"]);
    const r = parseExport(md);
    expect(r.ok && r.hidden).toEqual(["cooldown"]);
    expect(toMarkdown([legDay()], {}, "lb", new Date())).not.toContain('"hidden"');
    const s = createDataStore(memory());
    s.getState().hideExercise("warm-up");
    s.getState().mergeHidden(["cooldown", "warm-up"]);
    expect(s.getState().hiddenExercises).toEqual(["warm-up", "cooldown"]);
  });
});

describe("names from pasted plans", () => {
  it("the store remembers names once each, keeping the first spelling", () => {
    const s = createDataStore(memory());
    s.getState().addKnownNames(["Romanian deadlift", " romanian  DEADLIFT ", "Dead bugs"]);
    s.getState().addKnownNames(["Dead bugs"]);
    expect(s.getState().knownNames).toEqual(["Romanian deadlift", "Dead bugs"]);
  });
  it("they appear in the Exercises list", () => {
    const names = allExerciseNames({ workouts: [], active: null, templates: [], upNext: [], videos: {}, knownNames: ["Romanian deadlift"] }, {});
    expect(names).toEqual([{ key: "romanian deadlift", display: "Romanian deadlift" }]);
  });
  it("plan names include circuit moves", () => {
    const r = parsePlan("## RDL\nstrength: 3x8\n## Core\ncircuit: 1 round\n- Dead bugs 8 reps/side", "lb");
    if (!r.ok) throw new Error();
    expect(planNames(r.plan)).toEqual(["RDL", "Core", "Dead bugs"]);
  });
  it("full backups carry them", () => {
    const md = toMarkdown([], {}, "lb", new Date(), {}, [], ["Romanian deadlift"]);
    const r = parseExport(md);
    expect(r.ok && r.known).toEqual(["Romanian deadlift"]);
  });
});
