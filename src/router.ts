import { useEffect, useState } from "react";

export const ROUTES = [
  "/",
  "/paste",
  "/workout",
  "/finish",
  "/history",
  "/history/:id",
  "/templates",
  "/templates/:id",
  "/trends",
  "/trends/:name",
  "/settings",
] as const;

export type RoutePath = (typeof ROUTES)[number];
export type Route = { path: RoutePath; params: Record<string, string> };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const parts = raw.split("/").filter(Boolean);
  for (const pattern of ROUTES) {
    const pp = pattern.split("/").filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(":")) params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pp[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { path: pattern, params };
  }
  return { path: "/", params: {} };
}

export function navigate(to: string): void {
  window.location.hash = to;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => { setRoute(parseHash(window.location.hash)); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
