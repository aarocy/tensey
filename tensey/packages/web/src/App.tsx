import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/Canvas";
import { IntroOverlay } from "./components/IntroOverlay";
import { NodePalette } from "./components/NodePalette";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { TelemetryBar } from "./components/TelemetryBar";
import { Topbar } from "./components/Topbar";
import { useTenseyStore } from "./store/graph";

export default function App() {
  const paletteWidth = useTenseyStore((s) => s.paletteWidth);
  const inspectorWidth = useTenseyStore((s) => s.inspectorWidth);
  const setPaletteWidth = useTenseyStore((s) => s.setPaletteWidth);
  const setInspectorWidth = useTenseyStore((s) => s.setInspectorWidth);
  const layoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useTenseyStore.getState().runAnalysis();
  }, []);

  const beginResize = (side: "left" | "right") => (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const root = layoutRef.current;
    if (!root) return;
    const bounds = root.getBoundingClientRect();

    const onMove = (event: MouseEvent) => {
      if (side === "left") {
        setPaletteWidth(event.clientX - bounds.left);
      } else {
        setInspectorWidth(bounds.right - event.clientX);
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <ReactFlowProvider>
      <div className="relative h-full flex flex-col bg-surface-0">
        <Topbar />
        <div ref={layoutRef} className="relative flex-1 overflow-hidden">
          <div
            className="grid h-full overflow-hidden"
            style={{ gridTemplateColumns: `${paletteWidth}px minmax(0, 1fr) ${inspectorWidth}px` }}
          >
            <NodePalette />
            <Canvas />
            <PropertiesPanel />
          </div>

          <ResizeHandle side="left" left={paletteWidth} onMouseDown={beginResize("left")} />
          <ResizeHandle side="right" right={inspectorWidth} onMouseDown={beginResize("right")} />
        </div>
        <TelemetryBar />
        <IntroOverlay />
      </div>
    </ReactFlowProvider>
  );
}

function ResizeHandle({
  side,
  left,
  right,
  onMouseDown,
}: {
  side: "left" | "right";
  left?: number;
  right?: number;
  onMouseDown: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Resize blocks panel" : "Resize inspector panel"}
      onMouseDown={onMouseDown}
      className="absolute top-0 bottom-0 z-10 w-3 -translate-x-1/2 flex items-center justify-center text-[10px] text-text-disabled hover:text-text-primary focus:outline-none cursor-col-resize"
      style={side === "left" ? { left } : { right }}
    >
      <span className="pointer-events-none select-none">↔</span>
    </button>
  );
}
