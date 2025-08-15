import React from "react";
import { cn } from "./_utils";

export function Label({ className, ...props }) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}
