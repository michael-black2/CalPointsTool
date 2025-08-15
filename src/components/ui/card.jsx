import React from "react";
import { cn } from "./_utils";

export function Card({ className, ...props }) {
  return <div className={cn("rounded-2xl border bg-white shadow-sm", className)} {...props} />;
}
export function CardHeader({ className, ...props }) {
  return <div className={cn("p-4 border-b", className)} {...props} />;
}
export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />;
}
export function CardContent({ className, ...props }) {
  return <div className={cn("p-4", className)} {...props} />;
}
export function CardFooter({ className, ...props }) {
  return <div className={cn("p-4 border-t", className)} {...props} />;
}
