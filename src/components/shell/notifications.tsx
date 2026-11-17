"use client";

import { Bell, CheckCheck, Info, TriangleAlert, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppNotification } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const toneIcon = {
  info: Info,
  warning: TriangleAlert,
  success: CheckCircle2,
} as const;

const toneClass = {
  info: "text-info",
  warning: "text-warning",
  success: "text-success",
} as const;

export function NotificationsMenu({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
            {unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Notifications
          </span>
          <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
            <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Demo feed
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ul className="max-h-96 overflow-y-auto py-1">
          {notifications.map((notification) => {
            const Icon = toneIcon[notification.tone];
            return (
              <li
                key={notification.id}
                className={cn(
                  "flex gap-2.5 border-b border-border/60 px-3 py-2.5 last:border-0",
                  !notification.read && "bg-info-soft/40",
                )}
              >
                <Icon
                  className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass[notification.tone])}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium leading-snug">{notification.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                    {notification.detail}
                  </p>
                  <p className="mt-1 text-[10.5px] uppercase tracking-wide text-muted-foreground/80">
                    {timeAgo(notification.at)}
                  </p>
                </div>
                {!notification.read && (
                  <span className="ml-auto mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />
                )}
              </li>
            );
          })}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
