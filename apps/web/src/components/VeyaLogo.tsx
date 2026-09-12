import clsx from "clsx";

export function VeyaLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "veya-logo-wrap",
        size === "sm" && "veya-logo-wrap-sm",
        size === "lg" && "veya-logo-wrap-lg",
        className,
      )}
    >
      <img src="/veya-logo.png" alt="Veya" className="veya-logo" decoding="async" />
    </span>
  );
}
