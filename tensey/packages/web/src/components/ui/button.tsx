import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  default: "border-accent bg-accent text-white hover:bg-accent-hover",
  secondary: "border-border bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary",
  ghost: "border-transparent bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary",
  danger: "border-transparent bg-transparent text-error hover:bg-error/10",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3 text-sm",
  icon: "h-8 w-8 justify-center p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
