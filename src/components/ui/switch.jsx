import React, { useState } from "react";
import { cn } from "./_utils";

/** Minimal controlled Switch with same API as your code expects: (checked,onCheckedChange) */
export function Switch({ checked, onCheckedChange, className, id }) {
  const [focused, setFocused] = useState(false);
  return (
    <button
      id={id}
      role="switch"
      aria-checked={!!checked}
      onClick={() => onCheckedChange?.(!checked)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-black" : "bg-gray-300",
        focused && "ring-2 ring-black/30",
        className
      )}
      type="button"
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}
