import type { ReactNode } from "react";
import { FlashOverlay } from "./components/Flash";
import { useHashRoute, type RoutePath } from "./router";
import { useData } from "./store/data";
import { Finish } from "./screens/Finish";
import { Paste } from "./screens/Paste";
import { Start } from "./screens/Start";
import { Workout } from "./screens/Workout";

const NAV: { to: string; label: string; match: string }[] = [
  { to: "#/", label: "Start", match: "/" },
  { to: "#/history", label: "History", match: "/history" },
  { to: "#/trends", label: "Trends", match: "/trends" },
  { to: "#/templates", label: "Templates", match: "/templates" },
  { to: "#/settings", label: "Settings", match: "/settings" },
];

function screen(path: RoutePath, params: Record<string, string>): ReactNode {
  void params;
  switch (path) {
    case "/paste": return <Paste />;
    case "/workout": return <Workout />;
    case "/finish": return <Finish />;
    default: return <Start />;
  }
}

export default function App() {
  const route = useHashRoute();
  const storageError = useData((s) => s.storageError);
  const hideNav = route.path === "/workout";
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <FlashOverlay />
      {storageError && (
        <div className="bg-rose-800 px-4 py-2 text-sm">Couldn't save to this phone (storage full). Export your log now from Settings.</div>
      )}
      <main className={`flex-1 px-4 pt-4 ${hideNav ? "pb-6" : "pb-24"}`}>{screen(route.path, route.params)}</main>
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-slate-900 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-xl">
            {NAV.map((n) => {
              const active = n.match === "/" ? route.path === "/" : route.path.startsWith(n.match);
              return (
                <a key={n.to} href={n.to}
                  className={`flex min-h-touch flex-1 items-center justify-center text-sm ${active ? "text-sky-400" : "text-slate-400"}`}>
                  {n.label}
                </a>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
