"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Building2, ChevronRight, Fingerprint, Loader2, ShieldCheck, User, UserCheck, } from "lucide-react";
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
const DEMO_IDENTITIES: Record<Tab, {
    label: string;
    boId: string;
    name: string;
    holder?: string;
}[]> = {
    individual: [
        { label: "Rashedul Islam — Meghna Textiles · 1,250 sh", boId: "12012345678901234", name: "Rashedul Islam" },
        { label: "Farhana Akter — Meghna Textiles · 8,400 sh", boId: "12012345678902345", name: "Farhana Akter" },
        { label: "Chayan Chowdhury — Karnaphuli Cement · 3,300 sh", boId: "12012345678903333", name: "Chayan Chowdhury" },
    ],
    corporate: [
        { label: "Imran Kabir for Delta Pharma · 1,050,000 sh", boId: "12012345678909999", name: "Imran Kabir", holder: "Delta Pharmaceuticals Limited" },
    ],
    proxy: [
        { label: "Mahir Rahman — proxy for Rashedul Islam · 1,250 sh", boId: "12012345678901234", name: "Mahir Rahman", holder: "Rashedul Islam" },
    ],
};
export function PortalLoginForm({ nextTarget }: {
    nextTarget: string;
}) {
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
    const submitIdentity = (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        if (tab !== "individual" && !holderName.trim()) {
            setError(tab === "corporate" ? "Enter the company name" : "Enter the grantor's (shareholder's) name");
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
    return (<div className="mx-auto max-w-md">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold leading-tight tracking-tight">{t("Join your company's meeting")}</h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{t("Identify yourself exactly as you appear in the shareholder register. We verify against the record-date snapshot \u2014 BO ID and name alone never grant access without the one-time code.")}</p>
      </div>

      {/* Identity kind tabs — mirrors the login types in the manual */}
      <div role="tablist" aria-label={t("Login type")} className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {TABS.map(({ value, label, icon: Icon, hint }) => (<button key={value} role="tab" aria-selected={tab === value} title={t(hint)} onClick={() => switchTab(value)} className={cn("flex h-11 flex-col items-center justify-center rounded-md outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring", tab === value ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}>
            <span className="flex items-center gap-1.5 text-[12px] font-medium">
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden/>
              {t(label)}
            </span>
          </button>))}
      </div>

      {step === "identity" ? (<form onSubmit={submitIdentity} className="mt-5 space-y-4 rounded-lg border border-border bg-card p-5 shadow-card" noValidate>
          {tab === "corporate" && (<div className="space-y-1.5">
              <Label htmlFor="holder">{t("Company name")}</Label>
              <Input id="holder" value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder={t("Delta Pharmaceuticals Limited")} autoComplete="organization"/>
            </div>)}
          {tab === "proxy" && (<div className="space-y-1.5">
              <Label htmlFor="holder">{t("Appointed by (shareholder name)")}</Label>
              <Input id="holder" value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder={t("Rashedul Islam")} autoComplete="off"/>
            </div>)}
          <div className="space-y-1.5">
            <Label htmlFor="boid">{tab === "individual" ? t("BO ID / Folio ID") : tab === "corporate" ? t("BO ID / Folio ID (company account)") : t("Grantor's BO ID / Folio ID")}</Label>
            <Input id="boid" value={boId} onChange={(e) => setBoId(e.target.value)} inputMode="numeric" placeholder={t("12012345678901234")} className="font-mono" autoComplete="off"/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">{tab === "individual" ? t("Name of shareholder") : tab === "corporate" ? t("Authorized person's name") : t("Proxy's name")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("As per the register")} autoComplete="off"/>
          </div>

          {error && <p role="alert" className="rounded-md border border-destructive/30 bg-danger-soft px-3 py-2 text-[12px] text-destructive">{t(error)}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden/> : <ShieldCheck className="h-4 w-4" aria-hidden/>}{t("Verify identity")}</Button>

          <details className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[11.5px] text-muted-foreground">
            <summary className="cursor-pointer font-medium">{t("Demo identities (tap to fill)")}</summary>
            <ul className="mt-2 space-y-1">
              {DEMO_IDENTITIES[tab].map((identity) => (<li key={identity.boId + identity.name}>
                  <button type="button" onClick={() => fill(identity)} className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left font-mono text-[10.5px] hover:bg-muted">
                    <span>{t(identity.label)}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden/>
                  </button>
                </li>))}
            </ul>
          </details>
        </form>) : (<form onSubmit={submitOtp} className="mt-5 space-y-4 rounded-lg border border-border bg-card p-5 shadow-card" noValidate>
          <div className="rounded-md border border-info/30 bg-info-soft px-3 py-2.5 text-[12px] text-info">
            <p className="flex items-center gap-1.5 font-semibold"><Fingerprint className="h-4 w-4" aria-hidden/>{t("One-time code sent")}</p>
            <p className="mt-1 text-info/90">{t("Sent to the registered contact number")}{" "}<span className="font-mono">{mobile}</span>{t(". Eligible shares on record:")}{" "}<strong>{number(shares)}</strong>.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="otp">{t("6-digit code")}</Label>
            <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} autoFocus placeholder={t("\u2022\u2022\u2022\u2022\u2022\u2022")} className="h-12 text-center font-mono text-lg tracking-[0.35em]" autoComplete="one-time-code"/>
            <p className="text-[11px] text-muted-foreground">{t("Demo code:")}{" "}<span className="font-mono">482391</span>{t("\u2014 in production this arrives by SMS/email and expires in minutes.")}</p>
          </div>

          {error && <p role="alert" className="rounded-md border border-destructive/30 bg-danger-soft px-3 py-2 text-[12px] text-destructive">{t(error)}</p>}

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setStep("identity"); setOtp(""); setError(null); }}>{t("Back")}</Button>
            <Button type="submit" className="flex-1" disabled={pending || otp.length !== 6}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden/> : null}{t("Enter the portal")}</Button>
          </div>
        </form>)}
    </div>);
}
