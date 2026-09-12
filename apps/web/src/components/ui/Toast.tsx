export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="anim-rise fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg"
    >
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-teal to-teal-light" />
      <p className="m-0 flex-1 text-ink">{message}</p>
      <button type="button" onClick={onDismiss} className="text-muted hover:text-ink" aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
