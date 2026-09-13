import { createPortal } from "react-dom";
import type { RecoverySessionResponse } from "@shared/types";

const WHEN_LABEL: Record<0 | 1 | 24, string> = {
  0: "Now",
  1: "In 1 hour",
  24: "Tomorrow",
};

export function MockReminderInbox({
  session,
  onBackToTrip,
  onClose,
}: {
  session: RecoverySessionResponse;
  onBackToTrip: () => void;
  onClose: () => void;
}) {
  const steps = [...session.mockTimeline].sort((a, b) => a.atHours - b.atHours);

  return createPortal(
    <aside className="recovery-inbox" aria-label="Reminder preview">
      <header className="recovery-inbox-head">
        <div>
          <p className="recovery-eyebrow">Reminders</p>
          <h3 className="recovery-inbox-title">If you leave, we’ll nudge you</h3>
        </div>
        <button type="button" className="recovery-link muted" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <p className="recovery-inbox-lead">
        Preview only — nothing is emailed. Your trip sketch stays on Veya.
      </p>

      <ul className="recovery-inbox-list">
        {steps.map((step) => (
          <li key={`${step.atHours}-${step.subject}`} className="recovery-mail">
            <p className="recovery-mail-when">{WHEN_LABEL[step.atHours]}</p>
            <p className="recovery-mail-subject">{step.subject}</p>
            <p className="recovery-mail-body">{shortBody(step.body)}</p>
          </li>
        ))}
      </ul>

      <button type="button" className="recovery-toast-primary recovery-inbox-cta" onClick={onBackToTrip}>
        Back to my trip
      </button>
    </aside>,
    document.body,
  );
}

function shortBody(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 72) return trimmed;
  return `${trimmed.slice(0, 69).trim()}…`;
}
