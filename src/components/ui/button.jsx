import React from "react";
import { cn } from "./_utils";

const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background h-10 px-4 py-2";
const variants = {
  default: "bg-black text-white hover:bg-black/90",
  outline: "border border-input bg-transparent hover:bg-gray-100",
  ghost: "bg-transparent hover:bg-gray-100",
  secondary: "bg-gray-200 hover:bg-gray-300",
};

export const Button = React.forwardRef(function Button(
  { className, variant = "default", ...props }, ref
) {
  return <button ref={ref} className={cn(base, variants[variant], className)} {...props} />;
});
