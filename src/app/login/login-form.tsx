"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CheckCircle2, Landmark, Loader2, Sparkles, UserCheck } from "lucide-react";
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

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "admin@demo.local", desc: "Full governance & platform access" },
  { role: "Company Secretary", email: "secretary@demo.local", desc: "Meeting lifecycle & registry manager" },
  { role: "Restricted Viewer", email: "viewer@demo.local", desc: "Read-only compliance auditor" },
];

export function LoginForm({ nextTarget }: { nextTarget: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
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
        toast.success("Signed in successfully");
        router.replace(nextTarget);
        router.refresh();
      } else {
        setServerError(result.error ?? "Invalid email or password");
      }
    });
  });

  const quickFill = (email: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", "Demo@1234", { shouldValidate: true });
    toast.info(`Filled credentials for ${email}`);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel with subtle gradient */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-navy via-[#142036] to-[#0d1627] p-12 text-white lg:flex">
        {/* Ambient glow decoration */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-brand-navy shadow-md">
            <Landmark className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="leading-none">
            <span className="text-base font-bold tracking-tight">BRG1 IRM</span>
            <span className="block text-[10px] uppercase tracking-widest text-teal-300">Investor Relations</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Enterprise Shareholder & AGM Engine</span>
          </div>

          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white lg:text-4xl">
            The governance backbone for Bangladeshi corporate meetings.
          </h1>

          <p className="text-sm leading-relaxed text-slate-300">
            From record date snapshot to certified voting tallies — notices, eligibility, proxy appointments,
            live participation, secret ballot voting, and statutory minutes in one unified workspace.
          </p>

          <ul className="space-y-3.5 pt-2 text-xs text-slate-200">
            {[
              "Server-enforced eligibility and voting rules — never client-trusted",
              "Every state transition recorded to an append-only audit trail",
              "Legally configurable quorum, poll demand, and proxy limits per entity",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
          <span>BRG1 IRM · Enterprise Release</span>
          <span className="rounded-md border border-slate-700/60 bg-slate-800/40 px-2 py-0.5 text-[11px] font-mono text-slate-300">
            Dhaka Time (UTC+6)
          </span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile brand header */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy text-white">
              <Landmark className="h-4.5 w-4.5" strokeWidth={2} />
            </div>
            <span className="text-base font-bold tracking-tight">BRG1 IRM</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign in to your workspace</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Enter your company staff credentials to access governance controls.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                aria-invalid={!!errors.email}
                className="h-10 rounded-lg text-sm"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
                <span className="text-[11px] text-muted-foreground font-mono">Demo: Demo@1234</span>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                aria-invalid={!!errors.password}
                className="h-10 rounded-lg text-sm"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {serverError}
              </div>
            )}

            <Button
              type="submit"
              className="h-10 w-full rounded-lg bg-brand-navy font-semibold text-white shadow-sm hover:bg-brand-navy-hover dark:bg-brand dark:text-brand-foreground"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 text-brand" />
                1-Click Demo Login
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                Demo@1234
              </span>
            </div>

            <div className="mt-3 space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => quickFill(acc.email)}
                  className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-left text-xs transition-all hover:border-brand/40 hover:bg-muted"
                >
                  <div>
                    <p className="font-semibold text-foreground group-hover:text-brand">{acc.role}</p>
                    <p className="text-[11px] text-muted-foreground">{acc.email}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-brand opacity-0 transition-opacity group-hover:opacity-100">
                    Use →
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Are you an investor or shareholder?{" "}
              <Link href="/portal/login" className="font-semibold text-brand hover:underline">
                Open Shareholder Portal →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
