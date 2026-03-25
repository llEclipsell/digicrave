"use client";
// src/components/menu/CategoryTabs.tsx

import { useRef } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Category } from "@/types";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: Category[];
  activeId: string;
  onChange: (id: string) => void;
}

export function CategoryTabs({ categories, activeId, onChange }: CategoryTabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  function handleClick(id: string) {
    onChange(id);
    // Scroll the active pill into view
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center" });
  }

  return (
    <div className="sticky top-[56px] z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 px-4 py-2.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              ref={cat.id === activeId ? activeRef : undefined}
              onClick={() => handleClick(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                cat.id === activeId
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-200 dark:shadow-orange-900"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-0" />
      </ScrollArea>
    </div>
  );
}
