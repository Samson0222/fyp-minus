
import React from "react";
import { cn } from "@/lib/utils";

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  className,
  active = false,
  ...props
}) => {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-lg font-medium transition-all active:scale-95",
        active
          ? "bg-gradient-violet text-white"
          : "bg-dark-tertiary text-foreground/70 hover:text-white hover:bg-dark-tertiary/80",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default SecondaryButton;
