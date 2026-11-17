"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Building2, Check, ChevronsUpDown, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveCompany } from "@/lib/demo-auth";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CompanySwitcher({
  companies,
  activeId,
}: {
  companies: Company[];
  activeId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const active = companies.find((c) => c.id === activeId) ?? companies[0];
  if (!active) return null;

  const filtered = query
    ? companies.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()),
      )
    : companies;

  const pick = (id: string) =>
    startTransition(async () => {
      try {
        window.localStorage.setItem("irm.company", id);
      } catch {
        /* private mode */
      }
      await setActiveCompany(id);
      router.refresh();
    });

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label="Switch company"
        className="flex h-9 max-w-[13rem] items-center gap-2 rounded-md border border-border bg-card px-2.5 text-left shadow-card outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium leading-tight">
            {active.shortName}
          </span>
          <span className="block text-[10px] leading-tight text-muted-foreground">
            {active.listed ? "Listed" : "Unlisted"} · {active.sector}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Companies ({companies.length})
        </DropdownMenuLabel>
        {companies.length > 3 && (
          <div className="px-2 pb-1.5">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter companies…"
                aria-label="Filter companies"
                className="h-8 w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        )}
        <DropdownMenuSeparator />
        {filtered.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => pick(company.id)}
            className="flex items-center gap-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium">{company.name}</span>
              <span className="block text-[10.5px] text-muted-foreground">
                {company.registrationNo} · {company.sector}
              </span>
            </span>
            <Check
              className={cn(
                "h-4 w-4 shrink-0 text-brand",
                company.id === active.id ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
          </DropdownMenuItem>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-center text-[12px] text-muted-foreground">
            No company matches “{query}”
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
