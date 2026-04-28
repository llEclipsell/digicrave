// src/components/shared/PageWrapper.tsx
// MenEW DigiCrave — Page wrapper for customer-facing screens
// Provides: correct background color, mobile max-width (375–430px centered),
// and bottom padding to account for the fixed BottomNav.

import { cn } from "@/lib/utils";

interface PageWrapperProps {
  children: React.ReactNode;
  /** Extra class names appended to the wrapper */
  className?: string;
  /** If true, removes bottom padding (e.g. for pages with their own sticky footer) */
  noBottomPad?: boolean;
  /** If true, uses elevated (white) background instead of surface */
  elevated?: boolean;
}

export function PageWrapper({
  children,
  className,
  noBottomPad = false,
  elevated = false,
}: PageWrapperProps) {
  return (
    <div
      className={cn(
        "mx-auto min-h-screen w-full",
        !noBottomPad && "pb-[calc(56px+env(safe-area-inset-bottom,0px)+16px)]",
        className
      )}
      style={{
        maxWidth: 430,
        background: elevated
          ? "var(--color-bg-elevated)"
          : "var(--color-bg-primary)",
      }}
    >
      {children}
    </div>
  );
}
