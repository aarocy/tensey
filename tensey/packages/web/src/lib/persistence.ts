import type { IRGraph } from "@tensey/engine";

const FILE_VERSION = 1;

export interface TenseyFile {
  version: number;
  graph: IRGraph;
}

export function saveGraph(graph: IRGraph): void {
  const file: TenseyFile = { version: FILE_VERSION, graph };
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${graph.name.replace(/\s+/g, "-").toLowerCase() || "untitled"}.tensey.json`;
  a.click();
  URL.revokeObjectURL(url);
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
