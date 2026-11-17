"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/50 text-muted-foreground">
        <Sun className="h-4 w-4" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Toggle theme"
        className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground shadow-xs backdrop-blur-xs outline-none transition-all duration-150 hover:border-border hover:bg-muted/80 hover:text-foreground hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-teal-400 transition-transform duration-200 group-hover:-rotate-12" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500 transition-transform duration-200 group-hover:rotate-45" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex cursor-pointer items-center gap-2 text-xs font-medium"
        >
          <Sun className="h-3.5 w-3.5 text-amber-500" />
          <span>Light</span>
          {theme === "light" && <span className="ml-auto text-[10px] text-brand">Active</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex cursor-pointer items-center gap-2 text-xs font-medium"
        >
          <Moon className="h-3.5 w-3.5 text-sky-400" />
          <span>Dark</span>
          {theme === "dark" && <span className="ml-auto text-[10px] text-brand">Active</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex cursor-pointer items-center gap-2 text-xs font-medium"
        >
          <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
          <span>System</span>
          {theme === "system" && <span className="ml-auto text-[10px] text-brand">Active</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
