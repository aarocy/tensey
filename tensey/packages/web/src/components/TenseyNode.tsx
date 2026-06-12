import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { type TenseyNodeData } from "../store/graph";
import { getOp } from "@tensey/engine";
import clsx from "clsx";

const CAT_ACCENT: Record<string, string> = {
  io:           "text-text-secondary border-border",
  convolution:  "text-[#95a9c0] border-[#435263]",
  linear:       "text-[#a79db9] border-[#50485e]",
  activation:   "text-[#97ab9f] border-[#445347]",
  normalization:"text-[#b9af8f] border-[#5c5646]",
  pooling:      "text-[#b89d88] border-[#5d4f45]",
  attention:    "text-[#8faeb5] border-[#46555a]",
  recurrent:    "text-[#b199aa] border-[#584958]",
  reshape:      "text-[#a3aab2] border-[#50565d]",
  merge:        "text-[#9f9bbb] border-[#4b4860]",
  custom:       "text-text-secondary border-border",
};

function fmt(shape: (number | null)[] | null): string {
  if (!shape) return "?";
  return `[${shape.map((d) => d ?? "N").join("×")}]`;
}

export const TenseyNode = memo(function TenseyNode({ data, selected }: NodeProps<Node<TenseyNodeData>>) {
  const { irNode, hasError } = data;
  const cat = getOp(irNode.opType)?.category ?? "custom";
  const accentClass = CAT_ACCENT[cat] ?? CAT_ACCENT.custom;
  const [textColor, borderColor] = accentClass.split(" ");

  return (
    <div
      className={clsx(
        "relative min-w-[148px] bg-surface-1 border rounded cursor-pointer select-none",
        "transition-all duration-75",
        hasError ? "border-error/70 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]" :
        selected ? "border-accent/70 shadow-[0_0_0_1px_rgba(126,160,201,0.24)]" :
        borderColor
      )}
    >
      {/* Input handles */}
      {irNode.inputs.map((port, i) => (
        <Handle
          key={port.name} id={port.name} type="target" position={Position.Left}
          style={{ top: irNode.inputs.length === 1 ? "50%" : `${((i + 1) / (irNode.inputs.length + 1)) * 100}%` }}
          className="!w-1.5 !h-1.5 !rounded-none !border !border-border-strong !bg-surface-3"
        />
      ))}

      {/* Header bar */}
      <div className={clsx("px-2 py-1 flex items-center gap-1.5 border-b border-border/40")}>
        <span className={clsx("text-xs font-mono font-medium truncate flex-1", textColor)}>
          {irNode.label}
        </span>
        {hasError && <span className="text-2xs font-mono text-error shrink-0">!</span>}
      </div>

      {/* Shape rows */}
      {(irNode.inputs.length > 0 || irNode.outputs.length > 0) && (
        <div className="px-2 py-1.5 space-y-0.5">
          {irNode.inputs.map((p) => (
            <div key={p.name} className="flex items-center gap-1">
              <span className="text-2xs text-text-disabled w-5 shrink-0 font-mono">{p.name}</span>
              <span className="text-2xs font-mono text-text-tertiary">{fmt(p.shape)}</span>
            </div>
          ))}
          {irNode.inputs.length > 0 && irNode.outputs.length > 0 && (
            <div className="border-t border-border/20 my-0.5" />
          )}
          {irNode.outputs.map((p) => (
            <div key={p.name} className="flex items-center gap-1 justify-end">
              <span className="text-2xs font-mono text-text-secondary">{fmt(p.shape)}</span>
              <span className="text-2xs text-text-disabled w-5 shrink-0 font-mono text-right">{p.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Output handles */}
      {irNode.outputs.map((port, i) => (
        <Handle
          key={port.name} id={port.name} type="source" position={Position.Right}
          style={{ top: irNode.outputs.length === 1 ? "50%" : `${((i + 1) / (irNode.outputs.length + 1)) * 100}%` }}
          className="!w-1.5 !h-1.5 !rounded-none !border !border-border-strong !bg-surface-3"
        />
      ))}
    </div>
  );
});
