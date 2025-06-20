
import React from "react";
import { cn } from "@/lib/utils";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <button
      className={cn(
        "bg-gradient-violet text-white px-4 py-2 rounded-lg font-medium transition-all active:scale-95 hover:opacity-90",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default PrimaryButton;
