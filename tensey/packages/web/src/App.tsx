import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/Canvas";
import { NodePalette } from "./components/NodePalette";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { TelemetryBar } from "./components/TelemetryBar";
import { Topbar } from "./components/Topbar";

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="h-full flex flex-col bg-surface-0">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <NodePalette />
          <Canvas />
          <PropertiesPanel />
        </div>
        <TelemetryBar />
      </div>
    </ReactFlowProvider>
  );
}
