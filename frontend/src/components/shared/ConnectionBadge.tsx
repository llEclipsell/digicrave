"use client";
// src/components/shared/ConnectionBadge.tsx

import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionBadgeProps {
  connected: boolean;
  className?: string;
}

export function ConnectionBadge({ connected, className }: ConnectionBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        connected
          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
        className
      )}
    >
      {connected ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Live</span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Reconnecting…</span>
        </>
      )}
    </div>
  );
}
