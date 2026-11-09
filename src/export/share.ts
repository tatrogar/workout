/** The first file shape the browser will share: .md as given, then .md as text/plain, then .txt. */
export function pickShareFile(name: string, text: string, canShare: (f: File) => boolean): File | null {
  const txt = name.replace(/\.md$/, ".txt");
  const candidates = [
    new File([text], name, { type: "text/markdown" }),
    new File([text], name, { type: "text/plain" }),
    new File([text], txt, { type: "text/plain" }),
  ];
  return candidates.find((f) => { try { return canShare(f); } catch { return false; } }) ?? null;
}

/** Opens the Android share sheet with the file, or falls back to a download. */
export async function shareOrDownload(name: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  if (typeof navigator.canShare === "function") {
    const file = pickShareFile(name, text, (f) => navigator.canShare({ files: [f] }));
    if (file) {
      try {
        await navigator.share({ files: [file], title: name });
        return "shared";
      } catch (e) {
        if ((e as Error).name === "AbortError") return "cancelled";
      }
    }
  }
  const url = URL.createObjectURL(new File([text], name, { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
