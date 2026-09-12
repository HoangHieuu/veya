import clsx from "clsx";

export function OptionGrid({
  options,
  columns,
  onSelect,
  compact,
}: {
  options: {
    value: string;
    label: string;
    hint?: string;
    selected?: boolean;
  }[];
  columns: 1 | 2 | 3;
  onSelect: (value: string) => void;
  compact?: boolean;
}) {
  const hasSelection = options.some((o) => o.selected);

  return (
    <div
      className={clsx(
        "grid",
        compact ? "gap-2" : "gap-2.5",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-3",
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={clsx(
            "rounded-3xl border text-left transition duration-200 active:scale-[0.99]",
            compact ? "px-3 py-2" : "px-3.5 py-3",
            opt.selected
              ? "border-teal/45 accent-teal ring-2 ring-teal/15"
              : hasSelection
                ? "border-line/60 bg-surface-2/80 text-muted opacity-60 hover:opacity-80"
                : "border-line bg-surface hover:border-teal/25 hover:shadow-sm",
          )}
        >
          <span
            className={clsx(
              "block font-bold",
              compact ? "text-xs" : "text-sm",
              opt.selected ? "text-ink" : hasSelection ? "text-muted" : "text-ink",
            )}
          >
            {opt.label}
          </span>
          {opt.hint ? (
            <span className={clsx("mt-0.5 block text-muted", compact ? "text-[10px]" : "text-xs")}>
              {opt.hint}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
