import { useState, useCallback } from "react";
import { listOps, type OperatorDef } from "@tensey/engine";
import { useTenseyStore } from "../store/graph";
import clsx from "clsx";

const CATEGORY_ORDER = [
  "io","convolution","linear","activation","normalization",
  "pooling","attention","recurrent","reshape","merge","custom",
];

const CATEGORY_LABELS: Record<string,string> = {
  io:"I/O", convolution:"Conv", linear:"Linear", activation:"Act",
  normalization:"Norm", pooling:"Pool", attention:"Attn",
  recurrent:"RNN", reshape:"Shape", merge:"Merge", custom:"Custom",
};

const CATEGORY_COLOR: Record<string,string> = {
  io:"text-text-secondary", convolution:"text-[#95a9c0]", linear:"text-[#a79db9]",
  activation:"text-[#97ab9f]", normalization:"text-[#b9af8f]", pooling:"text-[#b89d88]",
  attention:"text-[#8faeb5]", recurrent:"text-[#b199aa]", reshape:"text-[#a3aab2]",
  merge:"text-[#9f9bbb]", custom:"text-text-secondary",
};

export function NodePalette() {
  const [query, setQuery] = useState("");
  const addNode = useTenseyStore((s) => s.addNode);
  const width = useTenseyStore((s) => s.paletteWidth);
  const ops = listOps();

  const filtered = query
    ? ops.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()) || o.opType.toLowerCase().includes(query.toLowerCase()))
    : ops;

  const grouped = CATEGORY_ORDER.reduce<Record<string, OperatorDef[]>>((acc, cat) => {
    const items = filtered.filter((o) => o.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const onDragStart = useCallback((e: React.DragEvent, opType: string) => {
    e.dataTransfer.setData("tensey/opType", opType);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const onClick = useCallback((opType: string) => {
    addNode(opType, { x: 300 + Math.random() * 160 - 80, y: 200 + Math.random() * 80 - 40 });
  }, [addNode]);

  return (
    <aside data-tutorial="palette" className="shrink-0 bg-surface-1 border-r border-border flex flex-col overflow-hidden" style={{ width }}>
      <div className="px-2 py-1.5 border-b border-border">
        <input
          type="text"
          placeholder="Search nodes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-surface-0 border border-border text-text-primary text-xs rounded-sm px-2 py-1 placeholder:text-text-disabled outline-none focus:border-accent transition-colors"
        />
      </div>
      <div className="flex-1 overflow-y-auto py-0.5">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mb-1">
            <div className="px-2.5 py-0.5 text-2xs text-text-disabled uppercase mt-1">
              {CATEGORY_LABELS[cat] ?? cat}
            </div>
            {items.map((op) => (
              <div
                key={op.opType}
                draggable
                onDragStart={(e) => onDragStart(e, op.opType)}
                onClick={() => onClick(op.opType)}
                className="px-2.5 py-1 mx-0.5 cursor-pointer flex items-center hover:bg-surface-3 active:bg-surface-4 transition-colors"
              >
                <span className={clsx("text-xs", CATEGORY_COLOR[cat])}>{op.label}</span>
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-xs text-text-disabled text-center">No match</div>
        )}
      </div>
    </aside>
  );
}
