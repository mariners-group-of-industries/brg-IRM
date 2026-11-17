"use client";

import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/demo-auth";
import { hasPermission, type RoleName } from "@/lib/permissions";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: RoleName;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex h-9 items-center gap-1.5 rounded-md px-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-[11px] font-semibold text-white">
          {initials(name)}
        </span>
        <span className="hidden text-left md:block">
          <span className="block max-w-36 truncate text-[12.5px] font-medium leading-tight">
            {name}
          </span>
          <span className="block text-[10.5px] leading-tight text-muted-foreground">{role}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="text-[13px] font-medium">{name}</p>
          <p className="text-[11.5px] font-normal text-muted-foreground">{email}</p>
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10.5px] font-medium text-foreground/80">
            <ShieldCheck className="h-3 w-3 text-brand" aria-hidden />
            {role}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasPermission(role, "users.view") && (
          <DropdownMenuItem onClick={() => router.push("/system/users")}>
            <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
            Profile & account
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await logoutAction();
              router.replace("/login");
              router.refresh();
            })
          }
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
