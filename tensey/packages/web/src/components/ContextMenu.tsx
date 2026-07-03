import { useEffect, useRef } from "react";
import clsx from "clsx";

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: never;
}

export interface ContextMenuSeparator {
  separator: true;
  label?: never;
  onClick?: never;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

interface Props {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [onClose]);

  // Clamp to viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - items.length * 28 - 16),
    zIndex: 1000,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="w-44 bg-surface-1 border border-border py-1 select-none"
    >
      {items.map((item, i) => {
        if ("separator" in item && item.separator) {
          return <div key={i} className="my-1 border-t border-border/60" />;
        }
        const it = item as ContextMenuItem;
        return (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => { if (!it.disabled) { it.onClick(); onClose(); } }}
            className={clsx(
              "w-full flex items-center justify-between px-3 py-1 text-xs transition-colors",
              it.disabled ? "text-text-disabled cursor-default" :
              it.danger ? "text-error hover:bg-error-bg" :
              "text-text-secondary hover:bg-surface-3 hover:text-text-primary"
            )}
          >
            <span>{it.label}</span>
            {it.shortcut && <span className="font-mono text-2xs text-text-disabled ml-4">{it.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
