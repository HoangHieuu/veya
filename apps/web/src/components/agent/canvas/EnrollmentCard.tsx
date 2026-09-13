import { Button } from "../../ui/Button";

export function EnrollmentCard() {
  return (
    <section className="agent-canvas-block agent-enroll" aria-label="Lotusmiles enrollment">
      <h3 className="agent-canvas-label">Claim your bonus miles</h3>
      <p className="agent-canvas-lead">
        Join Lotusmiles free to unlock the limited-time bonus on direct bookings.
      </p>
      <ul className="agent-enroll-list">
        <li>Earn standard miles plus discovery bonus on eligible routes</li>
        <li>Member-only offers on vietnamairlines.com — not on OTAs</li>
        <li>LotuStudents get extra earn on verified student bookings</li>
      </ul>
      <Button variant="secondary" className="w-full" disabled>
        Join Lotusmiles (demo)
      </Button>
      <p className="agent-canvas-muted agent-enroll-note">
        Return home and pick a member profile to preview bonus miles.
      </p>
    </section>
  );
}
