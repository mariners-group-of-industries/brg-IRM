"use client";

import { usePortalLanguage } from "@/components/portal/language-provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  Building2,
  Calendar,
  ChevronRight,
  CreditCard,
  FileCheck,
  Fingerprint,
  Loader2,
  Lock,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { verifyIdentityAction, signInWithOtpAction } from "../portal-actions";
import type { ParticipantKind } from "@/lib/types";

type Tab = ParticipantKind;

const TABS: {
  value: Tab;
  label: string;
  icon: typeof User;
  hint: string;
}[] = [
  { value: "individual", label: "Individual", icon: User, hint: "Personal BO / folio account" },
  { value: "corporate", label: "Corporate", icon: Building2, hint: "Authorized representative of a company holder" },
  { value: "proxy", label: "Proxy", icon: UserCheck, hint: "Appointed by a shareholder" },
];

const DEMO_IDENTITIES: Record<
  Tab,
  {
    label: string;
    boId: string;
    name: string;
    holder?: string;
  }[]
> = {
  individual: [
    { label: "Rashedul Islam — Meghna Textiles · 1,250 sh", boId: "12012345678901234", name: "Rashedul Islam" },
    { label: "Farhana Akter — Meghna Textiles · 8,400 sh", boId: "12012345678902345", name: "Farhana Akter" },
    { label: "Chayan Chowdhury — Karnaphuli Cement · 3,300 sh", boId: "12012345678903333", name: "Chayan Chowdhury" },
  ],
  corporate: [
    {
      label: "Imran Kabir for Delta Pharma · 1,050,000 sh",
      boId: "12012345678909999",
      name: "Imran Kabir",
      holder: "Delta Pharmaceuticals Limited",
    },
  ],
  proxy: [
    {
      label: "Mahir Rahman — proxy for Rashedul Islam · 1,250 sh",
      boId: "12012345678901234",
      name: "Mahir Rahman",
      holder: "Rashedul Islam",
    },
  ],
};

export function PortalLoginForm({ nextTarget }: { nextTarget: string }) {
  const { t, number } = usePortalLanguage();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("individual");
  const [boId, setBoId] = useState("");
  const [name, setName] = useState("");
  const [holderName, setHolderName] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"identity" | "otp">("identity");
  const [mobile, setMobile] = useState("");
  const [shares, setShares] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isDevOrDemo =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const submitIdentity = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (tab !== "individual" && !holderName.trim()) {
      setError(
        tab === "corporate"
          ? "Enter the company name"
          : "Enter the grantor's (shareholder's) name"
      );
      return;
    }
    startTransition(async () => {
      const result = await verifyIdentityAction({
        kind: tab,
        boId,
        name,
        holderName: holderName || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not verify");
        return;
      }
      setMobile(result.mobile);
      setShares(result.eligibleShares);
      setStep("otp");
    });
  };

  const submitOtp = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signInWithOtpAction({
        kind: tab,
        boId,
        name,
        holderName: holderName || undefined,
        otp,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not sign in");
        return;
      }
      toast.success(t("Signed in to the portal"));
      router.replace(nextTarget);
      router.refresh();
    });
  };

  const fill = (identity: (typeof DEMO_IDENTITIES)["individual"][number]) => {
    setBoId(identity.boId);
    setName(identity.name);
    setHolderName(identity.holder ?? "");
    setError(null);
  };

  const switchTab = (value: Tab) => {
    setTab(value);
    setStep("identity");
    setBoId("");
    setName("");
    setHolderName("");
    setOtp("");
    setError(null);
  };

  return (
    <div className="relative w-full overflow-hidden py-10 lg:py-16">
      {/* Decorative ambient background curves */}
      <div
        className="pointer-events-none absolute -bottom-24 -left-20 h-96 w-96 rounded-full bg-[#0C9488]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-10 right-10 h-80 w-80 rounded-full bg-[#192D50]/5 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Branded Introduction and Trust Features */}
          <div className="space-y-6 lg:col-span-7 lg:pr-8">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0C9488]/30 bg-gradient-to-r from-[#0C9488]/15 to-[#0C9488]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0C9488] shadow-xs">
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{t("SHAREHOLDER ACCESS")}</span>
            </div>

            {/* Display Headline */}
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-[#192D50] sm:text-4xl lg:text-[44px] lg:leading-[1.15]">
                Your Voice. Your Share. <br />
                <span className="relative inline-block text-[#192D50]">
                  Your Meeting.
                  {/* Subtle curved underline under Meeting */}
                  <svg
                    className="absolute -bottom-2.5 left-0 w-full overflow-visible text-[#0C9488]"
                    viewBox="0 0 100 12"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      d="M2 8C30 1 70 14 98 4"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
              <p className="pt-2 text-base leading-relaxed text-slate-600 sm:text-lg">
                {t(
                  "Securely join your company's AGM or EGM using your registered shareholder information."
                )}
              </p>
            </div>

            {/* Three Trust Features */}
            <div className="grid grid-cols-1 gap-3.5 pt-4 sm:grid-cols-3">
              <div className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-white/85 p-4 text-center shadow-xs backdrop-blur-xs transition-all hover:border-[#0C9488]/40 hover:shadow-sm">
                <span className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-[#0C9488]">
                  <ShieldCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="text-xs font-bold text-[#192D50]">
                  {t("Secure Verification")}
                </span>
              </div>

              <div className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-white/85 p-4 text-center shadow-xs backdrop-blur-xs transition-all hover:border-[#0C9488]/40 hover:shadow-sm">
                <span className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-[#0C9488]">
                  <Users className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="text-xs font-bold text-[#192D50]">
                  {t("Individual & Corporate Access")}
                </span>
              </div>

              <div className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-white/85 p-4 text-center shadow-xs backdrop-blur-xs transition-all hover:border-[#0C9488]/40 hover:shadow-sm">
                <span className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-[#0C9488]">
                  <FileCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="text-xs font-bold text-[#192D50]">
                  {t("Verified Shareholder Register")}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Verification Card */}
          <div className="flex justify-center lg:col-span-5 lg:justify-end">
            <div className="w-full max-w-[500px]">
              <div className="rounded-2xl border border-slate-200/70 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
                {/* Card Title & Icon */}
                <div className="flex items-start gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-[#0C9488]">
                    <Calendar className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[#192D50] sm:text-2xl">
                      {t("Join Your Company's Meeting")}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 sm:text-[13px]">
                      {t("Verify your shareholder identity to get access.")}
                    </p>
                  </div>
                </div>

                {/* Modern Segmented Selector */}
                <div
                  role="tablist"
                  aria-label={t("Login type")}
                  className="mt-6 grid grid-cols-3 gap-1 rounded-xl border border-slate-200/80 bg-slate-100/90 p-1"
                >
                  {TABS.map(({ value, label, icon: Icon, hint }) => (
                    <button
                      key={value}
                      role="tab"
                      aria-selected={tab === value}
                      title={t(hint)}
                      onClick={() => switchTab(value)}
                      className={cn(
                        "flex h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#0C9488]",
                        tab === value
                          ? "bg-gradient-to-r from-[#0C9488] to-[#0A7B71] text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      <span>{t(label)}</span>
                    </button>
                  ))}
                </div>

                {/* Step 1: Identity Form */}
                {step === "identity" ? (
                  <form onSubmit={submitIdentity} className="mt-6 space-y-4" noValidate>
                    {tab === "corporate" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="holder" className="text-xs font-semibold text-[#192D50]">
                          {t("Company name")}
                        </Label>
                        <div className="relative">
                          <Building2
                            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                            aria-hidden
                          />
                          <Input
                            id="holder"
                            value={holderName}
                            onChange={(e) => setHolderName(e.target.value)}
                            placeholder={t("Delta Pharmaceuticals Limited")}
                            autoComplete="organization"
                            className="h-12 rounded-lg border-slate-200 bg-white pl-10 text-sm focus:border-[#0C9488] focus:ring-2 focus:ring-[#0C9488]"
                          />
                        </div>
                      </div>
                    )}

                    {tab === "proxy" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="holder" className="text-xs font-semibold text-[#192D50]">
                          {t("Appointed by (shareholder name)")}
                        </Label>
                        <div className="relative">
                          <User
                            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                            aria-hidden
                          />
                          <Input
                            id="holder"
                            value={holderName}
                            onChange={(e) => setHolderName(e.target.value)}
                            placeholder={t("Rashedul Islam")}
                            autoComplete="off"
                            className="h-12 rounded-lg border-slate-200 bg-white pl-10 text-sm focus:border-[#0C9488] focus:ring-2 focus:ring-[#0C9488]"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="boid" className="text-xs font-semibold text-[#192D50]">
                        {tab === "individual"
                          ? t("BO ID / Folio ID")
                          : tab === "corporate"
                            ? t("BO ID / Folio ID (company account)")
                            : t("Grantor's BO ID / Folio ID")}
                      </Label>
                      <div className="relative">
                        <CreditCard
                          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                          aria-hidden
                        />
                        <Input
                          id="boid"
                          value={boId}
                          onChange={(e) => setBoId(e.target.value)}
                          inputMode="numeric"
                          placeholder={t("Enter your BO ID or Folio ID")}
                          className="h-12 rounded-lg border-slate-200 bg-white pl-10 font-mono text-sm tracking-wide focus:border-[#0C9488] focus:ring-2 focus:ring-[#0C9488]"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold text-[#192D50]">
                        {tab === "individual"
                          ? t("Name of shareholder")
                          : tab === "corporate"
                            ? t("Authorized person's name")
                            : t("Proxy's name")}
                      </Label>
                      <div className="relative">
                        <User
                          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                          aria-hidden
                        />
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t("As per the shareholder register")}
                          autoComplete="off"
                          className="h-12 rounded-lg border-slate-200 bg-white pl-10 text-sm focus:border-[#0C9488] focus:ring-2 focus:ring-[#0C9488]"
                        />
                      </div>
                    </div>

                    {error && (
                      <p
                        role="alert"
                        className="rounded-lg border border-red-200 bg-red-50/80 px-3.5 py-2.5 text-xs font-medium text-red-700"
                      >
                        {t(error)}
                      </p>
                    )}

                    {/* Primary Verification CTA */}
                    <Button
                      type="submit"
                      disabled={pending || !boId.trim() || !name.trim()}
                      className="h-12 w-full rounded-xl bg-gradient-to-r from-[#0C9488] to-[#192D50] text-sm font-semibold text-white shadow-md shadow-teal-950/15 transition-all hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[#0C9488] disabled:opacity-50"
                    >
                      {pending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          <span>{t("Verifying...")}</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4.5 w-4.5" aria-hidden />
                          <span>{t("Verify Identity →")}</span>
                        </>
                      )}
                    </Button>

                    {/* Trust messaging note box */}
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/70 p-3 text-xs leading-snug text-slate-600">
                      <Lock className="h-4 w-4 shrink-0 text-[#0C9488]" strokeWidth={2} aria-hidden />
                      <span>
                        {t(
                          "Your information will be verified with the company's shareholder register."
                        )}
                      </span>
                    </div>

                    {/* Sample demo accounts - shown only in dev / demo mode */}
                    {isDevOrDemo && (
                      <details className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-[11.5px] text-slate-500">
                        <summary className="cursor-pointer font-medium hover:text-slate-800">
                          {t("Demo identities (tap to fill)")}
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {DEMO_IDENTITIES[tab].map((identity) => (
                            <li key={identity.boId + identity.name}>
                              <button
                                type="button"
                                onClick={() => fill(identity)}
                                className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left font-mono text-[10.5px] hover:bg-slate-200/50"
                              >
                                <span>{identity.label}</span>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </form>
                ) : (
                  /* Step 2: OTP Verification */
                  <form onSubmit={submitOtp} className="mt-6 space-y-4" noValidate>
                    <div className="rounded-xl border border-teal-100 bg-teal-50/80 p-4 text-xs text-[#192D50]">
                      <p className="flex items-center gap-2 font-bold text-[#0C9488]">
                        <Fingerprint className="h-4 w-4" aria-hidden />
                        {t("One-time code sent")}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {t("Sent to the registered contact number")}{" "}
                        <span className="font-mono font-semibold text-[#192D50]">{mobile}</span>
                        {t(". Eligible shares on record:")}{" "}
                        <strong className="text-[#0C9488]">{number(shares)}</strong>.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="otp" className="text-xs font-semibold text-[#192D50]">
                        {t("6-digit code")}
                      </Label>
                      <Input
                        id="otp"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                        placeholder="••••••"
                        className="h-14 rounded-xl border-slate-300 text-center font-mono text-2xl font-bold tracking-[0.45em] focus:border-[#0C9488] focus:ring-2 focus:ring-[#0C9488]"
                        autoComplete="one-time-code"
                      />
                      <p className="pt-1 text-[11px] text-slate-500">
                        Verification code:{" "}
                        <span className="font-mono font-bold text-[#192D50]">482391</span> · sent via SMS/email gateway.
                      </p>
                    </div>

                    {error && (
                      <p
                        role="alert"
                        className="rounded-lg border border-red-200 bg-red-50/80 px-3.5 py-2.5 text-xs font-medium text-red-700"
                      >
                        {t(error)}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setStep("identity");
                          setOtp("");
                          setError(null);
                        }}
                        className="h-12 px-4 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      >
                        {t("Back")}
                      </Button>
                      <Button
                        type="submit"
                        disabled={pending || otp.length !== 6}
                        className="h-12 flex-1 rounded-xl bg-gradient-to-r from-[#0C9488] to-[#192D50] text-sm font-semibold text-white shadow-md shadow-teal-950/15 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[#0C9488] disabled:opacity-50"
                      >
                        {pending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            <span>{t("Verifying...")}</span>
                          </>
                        ) : (
                          <span>{t("Enter the portal")}</span>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Sub-footer under card */}
              <p className="mt-5 text-center text-xs text-slate-500">
                {t("Company secretary or administrator?")}{" "}
                <Link
                  href="/admin"
                  className="font-semibold text-[#0C9488] hover:text-[#192D50] hover:underline"
                >
                  {t("Sign in to Admin Workspace (/admin) →")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
