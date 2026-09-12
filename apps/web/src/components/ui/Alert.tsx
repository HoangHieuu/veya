import clsx from "clsx";

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error";
  children: string;
}) {
  return (
    <div
      role="status"
      className={clsx(
        "rounded-xl px-4 py-3 text-sm leading-relaxed",
        tone === "info" && "accent-teal text-teal",
        tone === "warn" && "accent-gold text-[#8a6d1a]",
        tone === "error" && "bg-red-50 text-danger",
      )}
    >
      {children}
    </div>
  );
}
