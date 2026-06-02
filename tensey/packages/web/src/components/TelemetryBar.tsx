import { useTenseyStore } from "../store/graph";
import clsx from "clsx";

export function TelemetryBar() {
  const telemetry = useTenseyStore((s) => s.telemetry);
  const shapeResult = useTenseyStore((s) => s.shapeResult);
  const nodes = useTenseyStore((s) => s.nodes);

  const errors = shapeResult?.diagnostics.filter((d) => d.severity === "error").length ?? 0;
  const warns = shapeResult?.diagnostics.filter((d) => d.severity === "warning").length ?? 0;

  const status = nodes.length === 0 ? "idle" : errors > 0 ? "error" : warns > 0 ? "warn" : "ok";

  return (
    <div className="h-6 bg-surface-0 border-t border-border flex items-center px-3 gap-0 shrink-0 font-mono text-2xs">
      {/* Status dot */}
      <div className={clsx("w-1.5 h-1.5 rounded-full mr-2 shrink-0",
        status === "idle" ? "bg-surface-4" :
        status === "error" ? "bg-error" :
        status === "warn" ? "bg-warning" : "bg-success"
      )} />
      <span className="text-text-disabled mr-3">
        {status === "idle" ? "—" : status === "error" ? `${errors} err` : status === "warn" ? `${warns} warn` : "valid"}
      </span>

      <Sep />
      <Stat label="nodes" value={String(nodes.length)} />

      {telemetry && (
        <>
          <Sep />
          <Stat label="params" value={telemetry.summary.params} />
          <Sep />
          <Stat label="flops" value={telemetry.summary.flops} dim />
          <Sep />
          <Stat label="vram" value={telemetry.summary.peakVram} dim />
        </>
      )}

      <div className="ml-auto text-text-disabled/40 font-mono text-2xs tracking-widest">tensey</div>
    </div>
  );
}

function Sep() {
  return <div className="w-px h-3 bg-border mx-2.5 shrink-0" />;
}

function Stat({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-text-disabled">{label}</span>
      <span className={dim ? "text-text-tertiary" : "text-text-secondary"}>{value}</span>
    </div>
  );
}
