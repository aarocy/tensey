import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { CircleHelp, GripVertical } from "lucide-react";
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
  const openIntro = useTenseyStore((s) => s.openIntro);
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
        <button
          type="button"
          aria-label="Open workspace guide"
          onClick={openIntro}
          className="absolute bottom-3 left-3 z-20 flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-1 text-text-secondary shadow-[0_8px_22px_rgba(0,0,0,0.2)] transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/65"
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </button>
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
      className="absolute top-0 bottom-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize items-center justify-center text-text-disabled hover:text-text-primary focus:outline-none"
      style={side === "left" ? { left } : { right }}
    >
      <GripVertical className="pointer-events-none h-4 w-4" aria-hidden="true" />
    </button>
  );
}
