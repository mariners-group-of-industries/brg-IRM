"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, UserCheck, UserPlus, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/registry/shared";
import { createStaffUserAction, updateStaffUserAction } from "./actions";
import type { Company } from "@/lib/types";
import { ROLE_PERMISSIONS, ROLES, type RoleName } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export interface PublicStaffUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  companyIds: string[];
  status: "active" | "invited" | "suspended";
  createdAt: string;
}

export function UsersClient({
  users,
  companies,
  canManage,
  isSuperAdmin,
  currentUserId,
}: {
  users: PublicStaffUser[];
  companies: Company[];
  canManage: boolean;
  isSuperAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("Company Secretary");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(
    companies[0] ? [companies[0].id] : [],
  );

  const companyNames = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c.shortName])),
    [companies],
  );

  const assignableRoles = useMemo(
    () => (isSuperAdmin ? ROLES : ROLES.filter((r) => r !== "Platform Super Admin")),
    [isSuperAdmin],
  );

  function toggleCompany(id: string) {
    setSelectedCompanies((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!selectedCompanies.length) {
      toast.error("Assign at least one company");
      return;
    }
    startTransition(async () => {
      const res = await createStaffUserAction({
        name,
        email,
        password,
        role,
        companyIds: selectedCompanies,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Staff account created — ready to sign in at /admin");
      setShowForm(false);
      setName("");
      setEmail("");
      setPassword("");
      router.refresh();
    });
  }

  function changeStatus(id: string, status: "active" | "suspended") {
    startTransition(async () => {
      const res = await updateStaffUserAction(id, { status });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(status === "suspended" ? "Account suspended" : "Account reactivated");
        router.refresh();
      }
    });
  }

  function changeRole(id: string, nextRole: RoleName) {
    startTransition(async () => {
      const res = await updateStaffUserAction(id, { role: nextRole });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`Role updated to ${nextRole}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {users.length} staff user(s) · Active accounts can sign in immediately via <span className="font-mono text-foreground">/admin</span>
        </p>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)} className="h-9 gap-1.5">
            {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showForm ? "Close form" : "Add staff user"}
          </Button>
        )}
      </div>

      {showForm && canManage && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-brand/30 bg-card p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-brand" />
            Provision new staff workspace user
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Full name" htmlFor="usr-name">
              <Input id="usr-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Tariqul Islam" />
            </Field>
            <Field label="Work email" htmlFor="usr-email">
              <Input id="usr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tariq@company.com" />
            </Field>
            <Field label="Initial password" htmlFor="usr-pass">
              <Input id="usr-pass" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min 6 characters" />
            </Field>
            <Field label="Governance role" htmlFor="usr-role">
              <NativeSelect id="usr-role" value={role} onChange={(e) => setRole(e.target.value as RoleName)}>
                {assignableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
              </NativeSelect>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium">Company scoping (multi-tenant access)</p>
            <div className="flex flex-wrap gap-2">
              {companies.map((c) => {
                const active = selectedCompanies.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCompany(c.id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs transition-all",
                      active
                        ? "border-brand bg-brand-soft/60 font-semibold text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {c.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>Create user account</Button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[50rem] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th scope="col" className="px-4 py-3">User</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Authorized Companies</th>
                <th scope="col" className="px-4 py-3">Status</th>
                {canManage && <th scope="col" className="px-4 py-3 text-right">Access Control</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">
                      {u.name} {u.id === currentUserId && <span className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] text-brand">You</span>}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && u.id !== currentUserId ? (
                      <NativeSelect
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        disabled={pending}
                        onChange={(e) => changeRole(u.id, e.target.value as RoleName)}
                        className="h-8 w-48"
                      >
                        {assignableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </NativeSelect>
                    ) : (
                      <span className="font-medium">{u.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.companyIds.map((cid) => (
                        <span key={cid} className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[10.5px]">
                          {companyNames[cid] ?? cid}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold capitalize",
                        u.status === "active"
                          ? "border-success/30 bg-success-soft text-success"
                          : "border-destructive/30 bg-danger-soft text-destructive",
                      )}
                    >
                      {u.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {u.id !== currentUserId ? (
                        u.status === "active" ? (
                          <Button size="sm" variant="ghost" disabled={pending} onClick={() => changeStatus(u.id, "suspended")} className="h-7 px-2 text-[11px] text-destructive">
                            <UserX className="mr-1 h-3.5 w-3.5" /> Suspend
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => changeStatus(u.id, "active")} className="h-7 px-2 text-[11px] text-success">
                            <UserCheck className="mr-1 h-3.5 w-3.5" /> Activate
                          </Button>
                        )
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Current session</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Catalogue Reference */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-brand" />
          Nine-role RBAC permission catalogue
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r} className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">{r}</p>
                <span className="font-mono text-[10px] text-brand">{ROLE_PERMISSIONS[r].length} perms</span>
              </div>
              <p className="mt-1.5 line-clamp-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {ROLE_PERMISSIONS[r].join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
