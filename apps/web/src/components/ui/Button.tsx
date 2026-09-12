import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-200",
        "disabled:pointer-events-none disabled:opacity-45",
        variant === "primary" && "btn-primary text-white active:scale-[0.98]",
        variant === "secondary" &&
          "border border-line bg-surface text-teal hover:bg-surface-2",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
