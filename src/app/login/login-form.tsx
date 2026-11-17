"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Landmark, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/lib/demo-auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type FormValues = z.infer<typeof schema>;

export function LoginForm({ nextTarget }: { nextTarget: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(values);
      if (result.ok) {
        toast.success("Signed in");
        router.replace(nextTarget);
        router.refresh();
      } else {
        setServerError(result.error ?? "Invalid email or password");
      }
    });
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-brand-navy p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-white">
            <Landmark className="h-4.5 w-4.5" strokeWidth={1.75} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">BRG1 IRM</span>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="text-[28px] font-semibold leading-[1.25] tracking-tight text-white">
            The governance backbone for Bangladeshi shareholder meetings.
          </h1>
          <p className="text-[13.5px] leading-6 text-slate-300">
            From record date to certified results — eligibility, notices, registration,
            live participation, voting, scrutiny and minutes in one audited workspace.
          </p>
          <ul className="space-y-3 text-[13px] text-slate-200">
            {[
              "Server-side eligibility and voting rules — never trusted to the browser",
              "Every state change written to an append-only audit log",
              "Legally configurable quorum, poll and proxy rules per company",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" strokeWidth={1.75} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11.5px] text-slate-400">
          BRG1 IRM · Investor Relationship Management · Demo build
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-navy text-white">
              <Landmark className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">BRG1 IRM</span>
          </div>

          <h2 className="text-[20px] font-semibold tracking-tight">Sign in to your workspace</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Use your company-issued credentials. Sessions expire after 12 hours.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" className="text-[12px] text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              {errors.password && (
                <p id="password-error" className="text-[12px] text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-danger-soft px-3 py-2 text-[12px] text-destructive">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Sign in
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">Are you a shareholder? <Link href="/portal/login" className="font-medium text-brand hover:underline">Open shareholder portal →</Link></p>

          <div className="mt-6 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> Demo mode
            </p>
            <p className="mt-1.5 text-[12px] leading-5 text-foreground/80">
              Seeded accounts, password <span className="font-mono">Demo@1234</span>:
            </p>
            <ul className="mt-1 space-y-0.5 font-mono text-[11.5px] text-foreground/75">
              <li>admin@demo.local — Super Admin</li>
              <li>secretary@demo.local — Company Secretary</li>
              <li>viewer@demo.local — Restricted Viewer</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
