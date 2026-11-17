"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  FileText,
  CalendarPlus,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_GROUPS } from "./nav";
import type { Company, Meeting } from "@/lib/types";
import type { RoleName } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

export function CommandPalette({
  role,
  companies,
  meetings,
}: {
  role: RoleName;
  companies: Company[];
  meetings: Meeting[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const navItems = NAV_GROUPS.flatMap((group) => group.items).filter(
    (item) => !item.permission || hasPermission(role, item.permission),
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="hidden h-9 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[12px] text-muted-foreground shadow-card outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring sm:flex sm:w-48 lg:w-56"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
      >
        <Search className="h-5 w-5" aria-hidden />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, companies, meetings…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {navItems.map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Companies">
            {companies.map((company) => (
              <CommandItem key={company.id} onSelect={() => go("/companies")}>
                <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                {company.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Meetings">
            {meetings.map((meeting) => (
              <CommandItem
                key={meeting.id}
                onSelect={() => go(`/governance/meetings/${meeting.id}`)}
              >
                {meeting.type === "AGM" ? (
                  <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                )}
                <span className="truncate">
                  {meeting.title}
                  <span className="text-muted-foreground"> · {meeting.financialYear}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => go("/governance/meetings/new")}>
              <CalendarPlus className="h-4 w-4 text-muted-foreground" aria-hidden />
              Create AGM / EGM
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
