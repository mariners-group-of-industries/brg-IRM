"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  useFieldArray,
  useForm,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Rocket,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  STEP_FIELDS,
  STEP_TITLES,
  WIZARD_STEPS,
  meetingDraftSchema,
  type MeetingDraft,
} from "@/lib/validations/meeting";
import { publishMeetingAction } from "./actions";
import type { Company } from "@/lib/types";

const DRAFT_KEY = "irm.meeting-draft";

const DEFAULT_VALUES: MeetingDraft = {
  companyId: "",
  type: "AGM",
  title: "",
  financialYear: "FY 2025–26",
  date: "",
  time: "10:30",
  timezone: "Asia/Dhaka",
  mode: "hybrid",
  venue: "",
  recordDate: "",
  shareClassId: "Ordinary",
  eligibleShareholders: 1000,
  votingEntitlement: "one_share_one_vote",
  pollDemandRule: "Shares carrying at least 10% of voting rights",
  proxiesAllowed: true,
  corporateRepresentatives: true,
  agenda: [
    { title: "Adoption of audited financial statements", kind: "ordinary", resolution: "" },
  ],
  registrationOpens: "",
  registrationCloses: "",
  proxyDeadline: "",
  proxyLimitPerHolder: 1,
  verificationWorkflow: "scrutineer_certification",
  votingMethod: "hybrid",
  votingStarts: "",
  votingEnds: "",
  voteConfirmation: true,
  earlyVoting: false,
  streamingProvider: "zoom",
  streamUrl: "",
  zoomMeetingId: "",
  zoomPasscode: "",
  hostName: "",
  moderatorCount: 2,
  autoRecord: true,
  noticeLanguage: "both",
  deliveryChannels: ["sms", "email", "website"],
  documentsToAttach: "",
  publishToWebsite: true,
};

const POLL_RULES = [
  "Shares carrying at least 10% of voting rights",
  "Shares carrying at least 5% of voting rights",
  "Any member present may demand a poll (Articles 52)",
  "Five or more members voting may demand a poll",
];

const DELIVERY_CHANNELS = [
  { value: "sms", label: "SMS to registered mobile" },
  { value: "email", label: "Email to registered address" },
  { value: "post", label: "Postal / courier to registered address" },
  { value: "newspaper", label: "National + English daily newspapers" },
  { value: "website", label: "Company website & BD platform filings" },
] as const;

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[12px] font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-[11.5px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "h-9 rounded-md border border-input bg-card px-3 text-[13px] shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-[invalid=true]:border-destructive";

export function CreateWizard({
  companies,
  defaultCompanyId,
}: {
  companies: Company[];
  defaultCompanyId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const form = useForm<MeetingDraft>({
    resolver: zodResolver(meetingDraftSchema),
    defaultValues: {
      ...DEFAULT_VALUES,
      companyId: defaultCompanyId,
      shareClassId:
        companies.find((c) => c.id === defaultCompanyId)?.shareClasses[0] ?? "Ordinary",
      eligibleShareholders:
        companies.find((c) => c.id === defaultCompanyId)?.totalShareholders ?? 1000,
    },
    mode: "onBlur",
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors, isDirty },
  } = form;
  const agenda = useFieldArray({ control, name: "agenda" });
  const values = watch();

  /* Restore draft */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = meetingDraftSchema.partial().safeParse(JSON.parse(raw));
        if (parsed.success) {
          // Keep the draft's company if it is one of the user's companies;
          // otherwise fall back to the active default.
          const companyId =
            parsed.data.companyId &&
            companies.some((c) => c.id === parsed.data.companyId)
              ? parsed.data.companyId
              : defaultCompanyId;
          reset({ ...DEFAULT_VALUES, ...parsed.data, companyId });
          setRestored(true);
        }
      }
    } catch {
      /* corrupted draft — start fresh */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Unsaved-changes warning */
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const saveDraft = () => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      toast.success("Draft saved on this device");
    } catch {
      toast.error("Could not save the draft in this browser");
    }
  };

  const goTo = async (next: number) => {
    const fields = STEP_FIELDS[step];
    const valid = fields ? await trigger(fields as never) : true;
    if (!valid) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const publish = handleSubmit((data) => {
    setPublishError(null);
    startTransition(async () => {
      const result = await publishMeetingAction(data);
      if (result.ok) {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        toast.success("Meeting created and queued for notice publishing");
        router.push(`/governance/meetings/${result.id}`);
      } else {
        setPublishError(result.error ?? "Publishing failed");
      }
    });
  });

  const selectedCompany = companies.find((c) => c.id === values.companyId);
  const err = (name: keyof MeetingDraft) =>
    (errors as FieldErrors<MeetingDraft>)[name]?.message as string | undefined;

  const progress = ((step - 1) / (WIZARD_STEPS - 1)) * 100;

  return (
    <form onSubmit={publish} noValidate>
      {restored && (
        <div className="mb-4 rounded-md border border-info/30 bg-info-soft px-3 py-2 text-[12px] text-info">
          A saved draft was restored from this browser.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        {/* Step rail (desktop) */}
        <ol className="hidden lg:block" aria-label="Wizard steps">
          {STEP_TITLES.map((title, index) => {
            const number = index + 1;
            const state = number < step ? "done" : number === step ? "current" : "upcoming";
            return (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => number < step && setStep(number)}
                  disabled={number > step}
                  aria-current={state === "current" ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors",
                    state === "current" && "bg-sidebar-accent",
                    state === "done" && "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
                    state === "upcoming" && "cursor-default opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                      state === "done" && "border-brand bg-brand text-white",
                      state === "current" && "border-brand-navy bg-brand-navy text-white",
                      state === "upcoming" && "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : number}
                  </span>
                  <span
                    className={cn(
                      "text-[12.5px]",
                      state === "current" ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Mobile progress */}
        <div className="lg:hidden">
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
            <span>Step {step} of {WIZARD_STEPS}</span>
            <span>{STEP_TITLES[step - 1]}</span>
          </div>
          <Progress value={progress} className="h-1.5" aria-label="Wizard progress" />
        </div>

        {/* Panel */}
        <div className="rounded-lg border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h1 className="text-[15px] font-semibold tracking-tight">
              {STEP_TITLES[step - 1]}
            </h1>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {isDirty ? "Unsaved changes" : "All changes saved as draft"}
            </p>
          </div>

          <div className="px-5 py-5">
            {/* STEP 1 — Basic information */}
            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company" htmlFor="companyId" required error={err("companyId")}>
                  <Select
                    value={values.companyId}
                    onValueChange={(value) => {
                      if (!value) return;
                      setValue("companyId", value, { shouldDirty: true });
                      const company = companies.find((c) => c.id === value);
                      if (company) {
                        setValue("shareClassId", company.shareClasses[0] ?? "Ordinary", { shouldDirty: true });
                        setValue("eligibleShareholders", company.totalShareholders, { shouldDirty: true });
                      }
                    }}
                  >
                    <SelectTrigger id="companyId" className="h-9 text-[13px]" aria-invalid={!!errors.companyId}>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Meeting type" htmlFor="type" required>
                  <div className="flex h-9 items-center gap-1 rounded-md border border-input p-0.5" role="group" aria-label="Meeting type">
                    {(["AGM", "EGM"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setValue("type", type, { shouldDirty: true })}
                        aria-pressed={values.type === type}
                        className={cn(
                          "h-8 flex-1 rounded text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          values.type === type ? "bg-brand-navy text-white" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {type === "AGM" ? "AGM" : "EGM"}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Meeting title" htmlFor="title" required error={err("title")} hint="Shown on the notice, portal and minutes.">
                    <Input id="title" className={inputClass} placeholder="24th Annual General Meeting" aria-invalid={!!errors.title} {...register("title")} />
                  </Field>
                </div>

                <Field label="Financial year" htmlFor="financialYear" required error={err("financialYear")}>
                  <Input id="financialYear" className={inputClass} placeholder="FY 2025–26" {...register("financialYear")} />
                </Field>

                <Field label="Timezone" htmlFor="timezone" required>
                  <Select value={values.timezone} onValueChange={(value) => value && setValue("timezone", value, { shouldDirty: true })}>
                    <SelectTrigger id="timezone" className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Dhaka">Asia/Dhaka (UTC+6)</SelectItem>
                      <SelectItem value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Meeting date" htmlFor="date" required error={err("date")}>
                  <Input id="date" type="date" className={inputClass} aria-invalid={!!errors.date} {...register("date")} />
                </Field>
                <Field label="Start time" htmlFor="time" required error={err("time")}>
                  <Input id="time" type="time" className={inputClass} {...register("time")} />
                </Field>

                <Field label="Mode" htmlFor="mode" required>
                  <Select value={values.mode} onValueChange={(value) => value && setValue("mode", value as MeetingDraft["mode"], { shouldDirty: true })}>
                    <SelectTrigger id="mode" className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Physical — venue only</SelectItem>
                      <SelectItem value="virtual">Virtual — video only</SelectItem>
                      <SelectItem value="hybrid">Hybrid — venue + video</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="sm:col-span-2">
                  <Field
                    label="Venue / streaming location"
                    htmlFor="venue"
                    required
                    error={err("venue")}
                    hint={values.mode === "virtual" ? "e.g. “Live video conference — link issued with the notice”" : undefined}
                  >
                    <Input id="venue" className={inputClass} placeholder="AGM Hall, Gulshan Club, Dhaka" aria-invalid={!!errors.venue} {...register("venue")} />
                  </Field>
                </div>
              </div>
            )}

            {/* STEP 2 — Eligibility */}
            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Record date" htmlFor="recordDate" required error={err("recordDate")} hint="Registered holders on this date are eligible to vote.">
                  <Input id="recordDate" type="date" className={inputClass} aria-invalid={!!errors.recordDate} {...register("recordDate")} />
                </Field>
                <Field label="Share class" htmlFor="shareClassId" required>
                  <Select value={values.shareClassId} onValueChange={(value) => value && setValue("shareClassId", value, { shouldDirty: true })}>
                    <SelectTrigger id="shareClassId" className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(selectedCompany?.shareClasses ?? ["Ordinary"]).map((shareClass) => (
                        <SelectItem key={shareClass} value={shareClass}>{shareClass}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Eligible shareholders (snapshot)" htmlFor="eligibleShareholders" required error={err("eligibleShareholders")}>
                  <Input id="eligibleShareholders" type="number" min={1} className={inputClass} {...register("eligibleShareholders", { valueAsNumber: true })} />
                </Field>
                <Field label="Voting entitlement" htmlFor="votingEntitlement" required>
                  <Select value={values.votingEntitlement} onValueChange={(value) => value && setValue("votingEntitlement", value as MeetingDraft["votingEntitlement"], { shouldDirty: true })}>
                    <SelectTrigger id="votingEntitlement" className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_share_one_vote">One share — one vote</SelectItem>
                      <SelectItem value="class_based">Class-based entitlements</SelectItem>
                      <SelectItem value="weighted">Weighted voting rights</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Poll demand rule" htmlFor="pollDemandRule" required>
                    <Select value={values.pollDemandRule} onValueChange={(value) => value && setValue("pollDemandRule", value, { shouldDirty: true })}>
                      <SelectTrigger id="pollDemandRule" className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {POLL_RULES.map((rule) => (
                          <SelectItem key={rule} value={rule}>{rule}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {[
                  { name: "proxiesAllowed" as const, label: "Proxies allowed", hint: "Eligible holders may appoint a proxy to vote on their behalf." },
                  { name: "corporateRepresentatives" as const, label: "Corporate representatives", hint: "Companies may nominate a representative to attend and vote." },
                ].map(({ name, label, hint }) => (
                  <label key={name} htmlFor={name} className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-border px-3 py-2.5">
                    <span>
                      <span className="text-[13px] font-medium">{label}</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{hint}</span>
                    </span>
                    <Switch
                      id={name}
                      checked={values[name]}
                      onCheckedChange={(checked) => setValue(name, checked, { shouldDirty: true })}
                    />
                  </label>
                ))}
              </div>
            )}

            {/* STEP 3 — Agenda & resolutions */}
            {step === 3 && (
              <div className="space-y-3">
                {agenda.fields.map((field, index) => (
                  <div key={field.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                      <Input
                        aria-label={`Agenda item ${index + 1} title`}
                        className={inputClass}
                        placeholder="Agenda item title"
                        aria-invalid={!!errors.agenda?.[index]?.title}
                        {...register(`agenda.${index}.title`)}
                      />
                      <Select
                        value={values.agenda[index]?.kind}
                        onValueChange={(value) => value && setValue(`agenda.${index}.kind`, value as "ordinary" | "special", { shouldDirty: true })}
                      >
                        <SelectTrigger className="h-9 w-28 text-[12px]" aria-label="Resolution type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ordinary">Ordinary</SelectItem>
                          <SelectItem value="special">Special</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex shrink-0 flex-col">
                        <button type="button" onClick={() => index > 0 && agenda.move(index, index - 1)} disabled={index === 0} aria-label="Move up" className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" onClick={() => index < agenda.fields.length - 1 && agenda.move(index, index + 1)} disabled={index === agenda.fields.length - 1} aria-label="Move down" className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <button type="button" onClick={() => agenda.remove(index)} aria-label="Remove agenda item" className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-destructive">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <div className="mt-2 pl-8">
                      <Input
                        aria-label={`Resolution for item ${index + 1}`}
                        className="h-8 text-[12px]"
                        placeholder="Resolution text (optional) — shown to voters"
                        {...register(`agenda.${index}.resolution`)}
                      />
                      {errors.agenda?.[index]?.title && (
                        <p role="alert" className="mt-1 text-[11.5px] text-destructive">
                          {errors.agenda[index]?.title?.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {errors.agenda?.root?.message && (
                  <p role="alert" className="text-[12px] text-destructive">{errors.agenda.root.message}</p>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => agenda.append({ title: "", kind: "ordinary", resolution: "" })}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add agenda item
                </Button>
              </div>
            )}

            {/* STEP 4 — Registration & proxy */}
            {step === 4 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Registration opens" htmlFor="registrationOpens" required error={err("registrationOpens")}>
                  <Input id="registrationOpens" type="datetime-local" className={inputClass} {...register("registrationOpens")} />
                </Field>
                <Field label="Registration closes" htmlFor="registrationCloses" required error={err("registrationCloses")}>
                  <Input id="registrationCloses" type="datetime-local" className={inputClass} aria-invalid={!!errors.registrationCloses} {...register("registrationCloses")} />
                </Field>
                <Field label="Proxy submission deadline" htmlFor="proxyDeadline" required error={err("proxyDeadline")}>
                  <Input id="proxyDeadline" type="datetime-local" className={inputClass} {...register("proxyDeadline")} />
                </Field>
                <Field label="Proxies per holder" htmlFor="proxyLimitPerHolder" required error={err("proxyLimitPerHolder")} hint="Legal limit is configurable — do not hard-code.">
                  <Input id="proxyLimitPerHolder" type="number" min={1} max={10} className={inputClass} {...register("proxyLimitPerHolder", { valueAsNumber: true })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Verification workflow" htmlFor="verificationWorkflow" required>
                    <Select value={values.verificationWorkflow} onValueChange={(value) => value && setValue("verificationWorkflow", value as MeetingDraft["verificationWorkflow"], { shouldDirty: true })}>
                      <SelectTrigger id="verificationWorkflow" className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None — auto-accept against register</SelectItem>
                        <SelectItem value="registrar_review">Registrar review — manual spot check</SelectItem>
                        <SelectItem value="scrutineer_certification">Scrutineer certification — every proxy certified</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            )}

            {/* STEP 5 — Voting */}
            {step === 5 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Voting method" htmlFor="votingMethod" required>
                  <Select value={values.votingMethod} onValueChange={(value) => value && setValue("votingMethod", value as MeetingDraft["votingMethod"], { shouldDirty: true })}>
                    <SelectTrigger id="votingMethod" className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="show_of_hands">Show of hands</SelectItem>
                      <SelectItem value="poll">Poll (share-weighted)</SelectItem>
                      <SelectItem value="hybrid">Hands first, poll on demand</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex flex-col justify-end">
                  <label htmlFor="earlyVoting" className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
                    <span>
                      <span className="text-[13px] font-medium">Early voting</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted-foreground">Open a voting window before the meeting starts.</span>
                    </span>
                    <Switch id="earlyVoting" checked={values.earlyVoting} onCheckedChange={(checked) => setValue("earlyVoting", checked, { shouldDirty: true })} />
                  </label>
                </div>
                <Field label="Voting opens" htmlFor="votingStarts" required error={err("votingStarts")}>
                  <Input id="votingStarts" type="datetime-local" className={inputClass} {...register("votingStarts")} />
                </Field>
                <Field label="Voting closes" htmlFor="votingEnds" required error={err("votingEnds")}>
                  <Input id="votingEnds" type="datetime-local" className={inputClass} aria-invalid={!!errors.votingEnds} {...register("votingEnds")} />
                </Field>
                <label htmlFor="voteConfirmation" className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5 sm:col-span-2">
                  <span>
                    <span className="text-[13px] font-medium">Vote confirmation & receipt</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">Show each voter a confirmation with a reference number. Always recommended.</span>
                  </span>
                  <Switch id="voteConfirmation" checked={values.voteConfirmation} onCheckedChange={(checked) => setValue("voteConfirmation", checked, { shouldDirty: true })} />
                </label>
              </div>
            )}

            {/* STEP 6 — Live meeting */}
            {step === 6 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Streaming provider" htmlFor="streamingProvider" required hint="Zoom embeds inside the Shareholder Meeting Room and also offers direct Zoom App launch.">
                    <Select value={values.streamingProvider} onValueChange={(value) => value && setValue("streamingProvider", value as MeetingDraft["streamingProvider"], { shouldDirty: true })}>
                      <SelectTrigger id="streamingProvider" className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zoom">Zoom — Embedded Web Client & Zoom App Launch</SelectItem>
                        <SelectItem value="irm_live">IRM Live / YouTube Live Embed</SelectItem>
                        <SelectItem value="webex">Cisco Webex — Embed / Join Link</SelectItem>
                        <SelectItem value="none">No live streaming (voting & Q&A only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {values.streamingProvider !== "none" && (
                  <>
                    <div className="sm:col-span-2">
                      <Field
                        label={values.streamingProvider === "zoom" ? "Zoom join link" : "Live stream / embed URL"}
                        htmlFor="streamUrl"
                        error={err("streamUrl")}
                        hint={values.streamingProvider === "zoom" ? "e.g. https://us06web.zoom.us/j/84291042219?pwd=..." : "Paste a YouTube Live URL, Vimeo Live, or custom embed link."}
                      >
                        <Input id="streamUrl" className={inputClass} placeholder={values.streamingProvider === "zoom" ? "https://us06web.zoom.us/j/..." : "https://youtube.com/live/..."} {...register("streamUrl")} />
                      </Field>
                    </div>
                    {values.streamingProvider === "zoom" && (
                      <>
                        <Field label="Zoom Meeting / Webinar ID" htmlFor="zoomMeetingId" error={err("zoomMeetingId")}>
                          <Input id="zoomMeetingId" className={inputClass} placeholder="842 9104 2219" {...register("zoomMeetingId")} />
                        </Field>
                        <Field label="Zoom Passcode" htmlFor="zoomPasscode" error={err("zoomPasscode")}>
                          <Input id="zoomPasscode" className={inputClass} placeholder="AGM2026" {...register("zoomPasscode")} />
                        </Field>
                      </>
                    )}
                  </>
                )}
                <Field label="Host / chair" htmlFor="hostName" required error={err("hostName")}>
                  <Input id="hostName" className={inputClass} placeholder="Mahi Uddin — Chairman" aria-invalid={!!errors.hostName} {...register("hostName")} />
                </Field>
                <Field label="Moderators assigned" htmlFor="moderatorCount" required error={err("moderatorCount")}>
                  <Input id="moderatorCount" type="number" min={0} max={20} className={inputClass} {...register("moderatorCount", { valueAsNumber: true })} />
                </Field>
                <label htmlFor="autoRecord" className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5 sm:col-span-2">
                  <span>
                    <span className="text-[13px] font-medium">Auto-record the meeting</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">Recording is stored against the meeting and quoted in the minutes.</span>
                  </span>
                  <Switch id="autoRecord" checked={values.autoRecord} onCheckedChange={(checked) => setValue("autoRecord", checked, { shouldDirty: true })} />
                </label>
              </div>
            )}

            {/* STEP 7 — Notices & documents */}
            {step === 7 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Notice language" htmlFor="noticeLanguage" required>
                  <Select value={values.noticeLanguage} onValueChange={(value) => value && setValue("noticeLanguage", value as MeetingDraft["noticeLanguage"], { shouldDirty: true })}>
                    <SelectTrigger id="noticeLanguage" className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English only</SelectItem>
                      <SelectItem value="bn">Bangla only</SelectItem>
                      <SelectItem value="both">Bangla + English</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex flex-col justify-end">
                  <label htmlFor="publishToWebsite" className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
                    <span>
                      <span className="text-[13px] font-medium">Publish to website</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted-foreground">Notice and documents visible on the public IRM portal.</span>
                    </span>
                    <Switch id="publishToWebsite" checked={values.publishToWebsite} onCheckedChange={(checked) => setValue("publishToWebsite", checked, { shouldDirty: true })} />
                  </label>
                </div>
                <fieldset className="sm:col-span-2">
                  <legend className="text-[12px] font-medium">Delivery channels<span className="ml-0.5 text-destructive" aria-hidden>*</span></legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {DELIVERY_CHANNELS.map((channel) => {
                      const checked = values.deliveryChannels.includes(channel.value as never);
                      return (
                        <label key={channel.value} htmlFor={`channel-${channel.value}`} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-[12px] hover:bg-muted/40">
                          <input
                            id={`channel-${channel.value}`}
                            type="checkbox"
                            className="h-4 w-4 accent-[#182b49]"
                            checked={checked}
                            onChange={(event) => {
                              const current = values.deliveryChannels;
                              setValue(
                                "deliveryChannels",
                                event.target.checked
                                  ? [...current, channel.value]
                                  : current.filter((value) => value !== channel.value),
                                { shouldDirty: true, shouldValidate: true },
                              );
                            }}
                          />
                          {channel.label}
                        </label>
                      );
                    })}
                  </div>
                  {errors.deliveryChannels?.message && (
                    <p role="alert" className="mt-1.5 text-[11.5px] text-destructive">{errors.deliveryChannels.message}</p>
                  )}
                </fieldset>
                <div className="sm:col-span-2">
                  <Field label="Documents to attach" htmlFor="documentsToAttach" hint="Comma-separated filenames, or leave empty to attach later in Documents.">
                    <Textarea id="documentsToAttach" rows={2} className="text-[13px]" placeholder="Notice.pdf, Annual-Report-FY2025-26.pdf, Proxy-Form.pdf" {...register("documentsToAttach")} />
                  </Field>
                </div>
              </div>
            )}

            {/* STEP 8 — Review */}
            {step === 8 && (
              <div className="space-y-5">
                <ReviewSection title="Meeting" items={[
                  ["Company", selectedCompany?.name ?? "—"],
                  ["Type", values.type],
                  ["Title", values.title || "—"],
                  ["Financial year", values.financialYear],
                  ["Date & time", values.date ? `${values.date}${values.time ? ` ${values.time}` : ""} (${values.timezone})` : "—"],
                  ["Mode", `${values.mode}${values.venue ? ` — ${values.venue}` : ""}`],
                ]} />
                <ReviewSection title="Eligibility & voting" items={[
                  ["Record date", values.recordDate || "—"],
                  ["Share class", values.shareClassId],
                  ["Eligible shareholders", String(values.eligibleShareholders)],
                  ["Voting entitlement", values.votingEntitlement.replaceAll("_", " ")],
                  ["Voting method", values.votingMethod.replaceAll("_", " ")],
                  ["Poll demand rule", values.pollDemandRule],
                  ["Proxy limit", `${values.proxyLimitPerHolder} per holder`],
                  ["Verification", values.verificationWorkflow.replaceAll("_", " ")],
                ]} />
                <ReviewSection title="Agenda" items={values.agenda.map((item, index) => [
                  `Item ${index + 1} (${item.kind})`,
                  item.title || "—",
                ])} />
                <ReviewSection title="Registration & comms" items={[
                  ["Registration", `${values.registrationOpens || "—"} → ${values.registrationCloses || "—"}`],
                  ["Voting window", `${values.votingStarts || "—"} → ${values.votingEnds || "—"}`],
                  ["Streaming", values.streamingProvider.replaceAll("_", " ")],
                  ["Host", values.hostName || "—"],
                  ["Notice language", values.noticeLanguage === "both" ? "Bangla + English" : values.noticeLanguage],
                  ["Delivery", values.deliveryChannels.join(", ")],
                ]} />

                {publishError && (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-danger-soft px-3 py-2 text-[12.5px] text-destructive">
                    {publishError}
                  </p>
                )}
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11.5px] leading-5 text-muted-foreground">
                  Publishing creates the meeting in <strong>notice pending</strong> state. The
                  21-day notice, SMS/email dispatch and Gazette filing are triggered from
                  Corporate Governance → Notices. Demo mode: data is stored in memory and
                  resets on restart.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
            <div>
              {step > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step < WIZARD_STEPS && (
                <Button type="button" variant="outline" size="sm" onClick={saveDraft}>
                  <Save className="h-4 w-4" aria-hidden />
                  Save draft
                </Button>
              )}
              {step < WIZARD_STEPS ? (
                <Button type="button" size="sm" onClick={() => goTo(step + 1)}>
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              ) : (
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Rocket className="h-4 w-4" aria-hidden />}
                  {pending ? "Publishing…" : "Create & queue notice"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function ReviewSection({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
}) {
  return (
    <section aria-label={title}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <dl className="mt-1.5 divide-y divide-border overflow-hidden rounded-md border border-border">
        {items.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[10rem_1fr] gap-3 bg-card px-3 py-2 sm:grid-cols-[12rem_1fr]">
            <dt className="text-[11.5px] font-medium text-muted-foreground">{label}</dt>
            <dd className="text-[12.5px] leading-snug">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
