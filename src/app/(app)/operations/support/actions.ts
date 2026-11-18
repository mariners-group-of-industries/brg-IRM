"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { createSupportTicket, demoStore, updateSupportTicket } from "@/lib/demo-store";

const ticketSchema = z.object({
  companyId: z.string().min(1, "Select a company"),
  boId: z.string().trim().max(32).optional().default(""),
  shareholderName: z.string().trim().min(2, "Enter shareholder name").max(160),
  category: z.enum(["bo_verification", "proxy_instrument", "dividend_claim", "meeting_access", "register_update"]),
  priority: z.enum(["high", "medium", "low"]),
  subject: z.string().trim().min(4, "Enter ticket subject").max(200),
  description: z.string().trim().min(6, "Enter issue details").max(2000),
});

export async function createSupportTicketAction(input: unknown) {
  const session = await requirePermission("support.view");
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid ticket input" };
  }
  const data = parsed.data;
  if (session.role !== "Platform Super Admin" && !session.companyIds.includes(data.companyId)) {
    notFound();
  }
  const ticket = createSupportTicket(
    {
      ...data,
      assignedTo: session.name,
    },
    session.email,
  );
  revalidatePath("/operations/support");
  revalidatePath("/reports/audit");
  revalidatePath("/activity");
  return { ok: true as const, ticketNo: ticket.ticketNo };
}

export async function updateSupportTicketAction(
  id: string,
  status: "open" | "in_progress" | "resolved",
  resolutionNote?: string,
) {
  const session = await requirePermission("support.view");
  const existing = demoStore.supportTickets.find((t) => t.id === id);
  if (!existing) notFound();
  if (session.role !== "Platform Super Admin" && !session.companyIds.includes(existing.companyId)) {
    notFound();
  }
  if (status === "resolved" && (!resolutionNote || resolutionNote.trim().length < 4)) {
    return { ok: false as const, error: "Provide a short resolution note before resolving" };
  }
  const updated = updateSupportTicket(
    id,
    { status, resolutionNote: resolutionNote?.trim(), assignedTo: session.name },
    session.email,
  );
  if (!updated) return { ok: false as const, error: "Ticket not found" };
  revalidatePath("/operations/support");
  revalidatePath("/reports/audit");
  revalidatePath("/activity");
  return { ok: true as const };
}
