"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Search,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MeetingModeLabel, MeetingStatusBadge, MeetingTypeBadge } from "@/components/status-badge";
import { formatDate, formatNumber } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { cn } from "@/lib/utils";

const columnHelper = createColumnHelper<Meeting>();
const COLUMN_LABELS: Record<string, string> = {
  title: "Meeting",
  company: "Company",
  date: "Date",
  mode: "Mode",
  status: "Status",
  eligible: "Eligible",
};

export function MeetingsTable({
  meetings,
  companies,
}: {
  meetings: Meeting[];
  companies: Record<string, string>;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "AGM" | "EGM">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: false }]);
  const [visibility, setVisibility] = useState<VisibilityState>({});

  const filtered = useMemo(
    () =>
      meetings.filter(
        (m) =>
          (typeFilter === "all" || m.type === typeFilter) &&
          (statusFilter === "all" || m.status === statusFilter),
      ),
    [meetings, typeFilter, statusFilter],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Meeting",
        cell: (info) => {
          const meeting = info.row.original;
          return (
            <Link
              href={`/governance/meetings/${meeting.id}`}
              className="group block outline-none"
            >
              <span className="flex items-center gap-2">
                <MeetingTypeBadge type={meeting.type} />
                <span className="text-[13px] font-medium group-hover:underline group-focus-visible:underline">
                  {meeting.title}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {meeting.financialYear}
              </span>
            </Link>
          );
        },
        enableHiding: false,
      }),
      columnHelper.accessor("companyId", {
        id: "company",
        header: "Company",
        cell: (info) => companies[info.getValue()] ?? info.getValue(),
        enableSorting: false,
      }),
      columnHelper.accessor("date", {
        header: "Date",
        cell: (info) => formatDate(info.getValue()),
        sortingFn: "datetime",
      }),
      columnHelper.accessor("mode", {
        header: "Mode",
        cell: (info) => <MeetingModeLabel mode={info.getValue()} />,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <MeetingStatusBadge status={info.getValue()} />,
        enableSorting: false,
      }),
      columnHelper.accessor("eligibleShareholders", {
        id: "eligible",
        header: "Eligible",
        cell: (info) => formatNumber(info.getValue()),
      }),
    ],
    [companies],
  );

  // TanStack Table is not React-Compiler-memoizable; state is stable by construction.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter, columnVisibility: visibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setVisibility,
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase();
      const m = row.original;
      return (
        m.title.toLowerCase().includes(q) ||
        m.financialYear.toLowerCase().includes(q) ||
        (companies[m.companyId] ?? "").toLowerCase().includes(q) ||
        m.venue.toLowerCase().includes(q)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const exportCsv = () => {
    const rows = table.getFilteredRowModel().rows.map((row) => row.original);
    const header = ["Type", "Meeting", "Financial year", "Company", "Date", "Mode", "Status", "Eligible shareholders"];
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [
      header.map(escape).join(","),
      ...rows.map((m) =>
        [
          m.type,
          m.title,
          m.financialYear,
          companies[m.companyId] ?? m.companyId,
          formatDate(m.date),
          m.mode,
          m.status.replaceAll("_", " "),
          m.eligibleShareholders,
        ]
          .map(escape)
          .join(","),
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "meetings.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search meetings, years, venues…"
            aria-label="Search meetings"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5" role="group" aria-label="Filter by type">
          {(["all", "AGM", "EGM"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              aria-pressed={typeFilter === type}
              className={cn(
                "h-8 rounded px-2.5 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                typeFilter === type
                  ? "bg-brand-navy text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {type === "all" ? "All" : type}
            </button>
          ))}
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="h-9 w-40" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["draft", "notice_pending", "notice_sent", "scheduled", "live", "voting_open", "completed", "archived"].map((status) => (
              <SelectItem key={status} value={status}>
                {status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-9" />}>
            <Columns3 className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Columns</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table.getAllLeafColumns().map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                disabled={!column.getCanHide()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {COLUMN_LABELS[column.id] ?? column.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}>
          <Download className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Export CSV</span>
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-9 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded"
                        aria-label={`Sort by ${COLUMN_LABELS[header.column.id] ?? header.column.id}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-28 text-center">
                  <p className="text-[13px] font-medium">No meetings match your filters</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Clear the search or filters, or create a new AGM/EGM.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[12px] text-muted-foreground">
        <p>
          {table.getFilteredRowModel().rows.length} meeting
          {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="tabular-nums">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
