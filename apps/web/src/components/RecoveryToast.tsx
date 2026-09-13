import { createPortal } from "react-dom";
import type { RecoverySessionResponse } from "@shared/types";

export function RecoveryToast({
  session,
  onResume,
  onOpenInbox,
  onDismiss,
}: {
  session: RecoverySessionResponse;
  onResume: () => void;
  onOpenInbox: () => void;
  onDismiss: () => void;
}) {
  const line = session.nudge.itineraryLine;
  return createPortal(
    <div role="status" className="recovery-toast" aria-live="polite">
      <div className="recovery-toast-body">
        <p className="recovery-toast-eyebrow">Still here</p>
        <p className="recovery-toast-title">Your Vietnam trip sketch is saved</p>
        <p className="recovery-toast-itinerary">{line}</p>
      </div>
      <div className="recovery-toast-actions">
        <button type="button" className="recovery-toast-primary" onClick={onResume}>
          Continue
        </button>
        <button type="button" className="recovery-link" onClick={onOpenInbox}>
          See reminders
        </button>
        <button
          type="button"
          className="recovery-toast-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
