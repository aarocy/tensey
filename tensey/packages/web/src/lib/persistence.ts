import type { IRGraph } from "@tensey/engine";

const FILE_VERSION = 1;
const WORKSPACE_STORAGE_KEY = "tensey:workspace";

export interface TenseyFile {
  version: number;
  graph: IRGraph;
}

export function downloadTextFile(filename: string, text: string, mimeType = "text/plain"): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveGraph(graph: IRGraph): void {
  const file: TenseyFile = { version: FILE_VERSION, graph };
  const json = JSON.stringify(file, null, 2);
  downloadTextFile(`${graph.name.replace(/\s+/g, "-").toLowerCase() || "untitled"}.tensey.json`, json, "application/json");
}

export function saveWorkspaceGraph(graph: IRGraph): void {
  if (typeof window === "undefined") return;
  const file: TenseyFile = { version: FILE_VERSION, graph };
  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(file));
}

export function loadWorkspaceGraph(): IRGraph | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TenseyFile;
    if (!parsed.graph || !Array.isArray(parsed.graph.nodes) || !Array.isArray(parsed.graph.edges)) {
      return null;
    }
    return parsed.graph;
  } catch {
    return null;
  }
}

export function clearWorkspaceGraph(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
}

export function loadGraph(file: File): Promise<IRGraph> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as TenseyFile;
        if (!parsed.graph || !Array.isArray(parsed.graph.nodes) || !Array.isArray(parsed.graph.edges)) {
          reject(new Error("Invalid .tensey.json file"));
          return;
        }
        resolve(parsed.graph);
      } catch {
        reject(new Error("Failed to parse file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
