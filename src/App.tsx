import { useHashRoute } from "./router";

const NAV: { to: string; label: string; match: string }[] = [
  { to: "#/", label: "Start", match: "/" },
  { to: "#/history", label: "History", match: "/history" },
  { to: "#/trends", label: "Trends", match: "/trends" },
  { to: "#/templates", label: "Templates", match: "/templates" },
  { to: "#/settings", label: "Settings", match: "/settings" },
];

export default function App() {
  const route = useHashRoute();
  const hideNav = route.path === "/workout";
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <main className="flex-1 px-4 pb-24 pt-4">
        <p className="text-slate-400">{route.path}</p>
      </main>
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 border-t border-slate-700 bg-slate-900">
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
