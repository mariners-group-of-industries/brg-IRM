"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { createCompany } from "@/lib/demo-store";
import { updateStaffUser } from "@/lib/demo-users";
import { createSessionCookie } from "@/lib/session";

const companySchema = z.object({
  name: z.string().trim().min(3, "Enter legal company name").max(160),
  shortName: z.string().trim().min(2, "Enter short display name").max(40),
  registrationNo: z.string().trim().min(3, "Enter RJSC registration number").max(60),
  tin: z.string().trim().min(4, "Enter company TIN").max(60),
  sector: z.string().trim().min(2, "Enter industry sector").max(80),
  type: z.enum(["Public Limited", "Private Limited"]),
  listed: z.boolean(),
  paidUpCapital: z.coerce.number().positive("Paid-up capital must be positive"),
  totalShareholders: z.coerce.number().int().min(1, "Enter registered shareholder count"),
  shareClasses: z.string().trim().min(2, "Enter at least one share class"),
});

export async function createCompanyAction(input: unknown) {
  const session = await requirePermission("companies.create");
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid company input" };
  }
  const d = parsed.data;
  const classes = [
    ...new Set(
      d.shareClasses
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
  if (!classes.length) {
    return { ok: false as const, error: "Provide at least one share class (e.g. Ordinary)" };
  }

  try {
    const company = createCompany(
      {
        name: d.name,
        shortName: d.shortName,
        registrationNo: d.registrationNo,
        tin: d.tin,
        sector: d.sector,
        type: d.type,
        listed: d.listed,
        paidUpCapital: d.paidUpCapital,
        totalShareholders: d.totalShareholders,
        shareClasses: classes,
      },
      session.email,
    );

    if (!session.companyIds.includes(company.id)) {
      const nextCompanies = [...session.companyIds, company.id];
      try {
        updateStaffUser(session.id, { companyIds: nextCompanies });
      } catch {
        // User might be dynamically constructed in test/cookie
      }
      await createSessionCookie({ ...session, companyIds: nextCompanies });
    }

    revalidatePath("/", "layout");
    revalidatePath("/companies");
    revalidatePath("/dashboard");
    revalidatePath("/reports/audit");
    revalidatePath("/activity");
    return { ok: true as const, id: company.id };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not onboard company" };
  }
}
