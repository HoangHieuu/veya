import clsx from "clsx";

export function VeyaLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <img
      src="/veya-logo.png"
      alt="Veya"
      className={clsx("veya-logo", size === "sm" && "veya-logo-sm", size === "lg" && "veya-logo-lg", className)}
      decoding="async"
    />
  );
}
