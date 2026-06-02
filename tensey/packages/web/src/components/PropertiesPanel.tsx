import { useTenseyStore } from "../store/graph";
import clsx from "clsx";
import type { ParamValue } from "@tensey/engine";

function fmt(shape: (number | null)[] | null): string {
  if (!shape) return "–";
  return `[${shape.map((d) => (d === null ? "N" : d)).join(", ")}]`;
}

function ParamField({ label, value, onChange }: { label: string; value: ParamValue; onChange: (v: ParamValue) => void }) {
  if (typeof value === "boolean") return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-2xs font-mono text-text-tertiary">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={clsx("text-2xs font-mono px-1.5 py-0.5 rounded border transition-colors",
          value ? "text-accent border-accent/40 bg-accent/5" : "text-text-disabled border-border bg-surface-3"
        )}
      >{value ? "true" : "false"}</button>
    </div>
  );

  if (Array.isArray(value)) return (
    <div className="py-0.5">
      <span className="text-2xs font-mono text-text-tertiary block mb-0.5">{label}</span>
      <input
        className="w-full bg-surface-0 border border-border text-text-primary text-2xs font-mono rounded px-1.5 py-1 outline-none focus:border-accent/50 transition-colors"
        value={value.join(", ")}
        onChange={(e) => {
          const parts = e.target.value.split(",").map((p) => p.trim() === "null" || p.trim() === "N" ? null : Number(p.trim())).filter((n) => n === null || !isNaN(n as number));
          onChange(parts as number[]);
        }}
      />
    </div>
  );

  return (
    <div className="py-0.5">
      <span className="text-2xs font-mono text-text-tertiary block mb-0.5">{label}</span>
      <input
        type={typeof value === "number" ? "number" : "text"}
        className="w-full bg-surface-0 border border-border text-text-primary text-2xs font-mono rounded px-1.5 py-1 outline-none focus:border-accent/50 transition-colors"
        value={value as string | number}
        onChange={(e) => onChange(typeof value === "number" ? Number(e.target.value) : e.target.value)}
      />
    </div>
  );
}

export function PropertiesPanel() {
  const selectedNodeId = useTenseyStore((s) => s.selectedNodeId);
  const nodes = useTenseyStore((s) => s.nodes);
  const shapeResult = useTenseyStore((s) => s.shapeResult);
  const telemetry = useTenseyStore((s) => s.telemetry);
  const updateNodeParams = useTenseyStore((s) => s.updateNodeParams);
  const deleteNode = useTenseyStore((s) => s.deleteNode);
  const duplicateNode = useTenseyStore((s) => s.duplicateNode);

  const node = nodes.find((n) => n.id === selectedNodeId);
  const irNode = node?.data.irNode;
  const nodeTel = telemetry?.nodes.find((n) => n.nodeId === selectedNodeId);
  const diags = shapeResult?.diagnostics.filter((d) => d.nodeId === selectedNodeId) ?? [];

  if (!irNode) return (
    <aside className="w-52 shrink-0 bg-surface-1 border-l border-border flex items-center justify-center">
      <span className="text-2xs font-mono text-text-disabled">no selection</span>
    </aside>
  );

  return (
    <aside className="w-52 shrink-0 bg-surface-1 border-l border-border flex flex-col overflow-hidden font-mono">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-mono font-medium text-text-primary">{irNode.label}</div>
          <div className="text-2xs font-mono text-text-disabled mt-0.5">{irNode.id}</div>
        </div>
        <div className="flex gap-1 shrink-0 mt-0.5">
          <PanelBtn onClick={() => duplicateNode(irNode.id)} title="Duplicate">⧉</PanelBtn>
          <PanelBtn onClick={() => deleteNode(irNode.id)} title="Delete" danger>✕</PanelBtn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Shapes */}
        {(irNode.inputs.length > 0 || irNode.outputs.length > 0) && (
          <Section label="shapes">
            {irNode.inputs.map((p) => (
              <Row key={p.name} label={`↓ ${p.name}`} value={fmt(p.shape)} dim />
            ))}
            {irNode.outputs.map((p) => (
              <Row key={p.name} label={`↑ ${p.name}`} value={fmt(p.shape)} />
            ))}
          </Section>
        )}

        {/* Params */}
        {Object.keys(irNode.params).length > 0 && (
          <Section label="params">
            {Object.entries(irNode.params).map(([k, v]) => (
              <ParamField key={k} label={k} value={v} onChange={(nv) => updateNodeParams(irNode.id, { [k]: nv })} />
            ))}
          </Section>
        )}

        {/* Telemetry */}
        {nodeTel && (
          <Section label="analysis">
            <Row label="params" value={nodeTel.paramCount.toLocaleString()} />
            <Row label="flops ~" value={nodeTel.flopsEstimate !== null ? nodeTel.flopsEstimate.toLocaleString() : "–"} dim />
            <Row label="act ~" value={nodeTel.activationBytesEstimate !== null ? `${(nodeTel.activationBytesEstimate / 1024).toFixed(1)}KB` : "–"} dim />
          </Section>
        )}

        {/* Diagnostics */}
        {diags.length > 0 && (
          <Section label="diagnostics">
            {diags.map((d, i) => (
              <div key={i} className={clsx("text-2xs font-mono rounded px-2 py-1.5 mb-1 leading-relaxed",
                d.severity === "error" ? "bg-error-bg text-error border border-error/20" :
                d.severity === "warning" ? "bg-warning-bg text-warning border border-warning/20" :
                "bg-surface-3 text-text-secondary"
              )}>
                {d.message}
              </div>
            ))}
          </Section>
        )}
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-b border-border/60">
      <div className="text-2xs font-mono text-text-disabled uppercase tracking-widest mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-2xs font-mono text-text-tertiary">{label}</span>
      <span className={clsx("text-2xs font-mono", dim ? "text-text-tertiary" : "text-text-secondary")}>{value}</span>
    </div>
  );
}

function PanelBtn({ onClick, children, title, danger }: { onClick: () => void; children: React.ReactNode; title?: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx("w-5 h-5 text-2xs font-mono rounded flex items-center justify-center transition-colors border",
        danger ? "text-error/60 border-error/20 hover:bg-error-bg hover:text-error" :
        "text-text-disabled border-border hover:bg-surface-3 hover:text-text-secondary"
      )}
    >{children}</button>
  );
}
