/** Centred rule + micro label used for day breaks and system events. */
export function StreamDivider({ label }: { label: string }) {
  return (
    <div className="my-1 flex items-center gap-2.5">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
