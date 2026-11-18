import { z } from "zod";

export const meetingDraftSchema = z
  .object({
    // Step 1 — Basic information
    companyId: z.string().min(1, "Select a company"),
    type: z.enum(["AGM", "EGM"]),
    title: z.string().trim().min(6, "Give the meeting a descriptive title").max(120),
    financialYear: z.string().trim().regex(/^FY \d{4}–\d{2}$/, "Use the format FY 2025–26"),
    date: z.string().min(1, "Pick a meeting date"),
    time: z.string().min(1, "Pick a start time"),
    timezone: z.string().min(1),
    mode: z.enum(["physical", "virtual", "hybrid"]),
    venue: z.string().trim().min(3, "Enter a venue or streaming location").max(200),

    // Step 2 — Eligibility
    recordDate: z.string().min(1, "Record date is required"),
    shareClassId: z.string().min(1, "Select a share class"),
    eligibleShareholders: z.number().int().min(1, "At least one eligible shareholder"),
    votingEntitlement: z.enum(["one_share_one_vote", "class_based", "weighted"]),
    pollDemandRule: z.string().min(1),
    proxiesAllowed: z.boolean(),
    corporateRepresentatives: z.boolean(),

    // Step 3 — Agenda & resolutions
    agenda: z
      .array(
        z.object({
          title: z.string().trim().min(4, "Agenda item needs a title"),
          kind: z.enum(["ordinary", "special"]),
          resolution: z.string().trim().max(200).optional().or(z.literal("")),
        }),
      )
      .min(1, "Add at least one agenda item")
      .max(30),

    // Step 4 — Registration & proxy
    registrationOpens: z.string().min(1, "Set registration opening"),
    registrationCloses: z.string().min(1, "Set registration closing"),
    proxyDeadline: z.string().min(1, "Set the proxy deadline"),
    proxyLimitPerHolder: z.number().int().min(1).max(10),
    verificationWorkflow: z.enum(["none", "registrar_review", "scrutineer_certification"]),

    // Step 5 — Voting configuration
    votingMethod: z.enum(["show_of_hands", "poll", "hybrid"]),
    votingStarts: z.string().min(1, "Set the voting window start"),
    votingEnds: z.string().min(1, "Set the voting window end"),
    voteConfirmation: z.boolean(),
    earlyVoting: z.boolean(),

    // Step 6 — Live meeting
    streamingProvider: z.enum(["irm_live", "zoom", "webex", "none"]),
    streamUrl: z.string().trim().max(500).optional(),
    zoomMeetingId: z.string().trim().max(40).optional(),
    zoomPasscode: z.string().trim().max(40).optional(),
    hostName: z.string().trim().min(2, "Assign a host"),
    moderatorCount: z.number().int().min(0).max(20),
    autoRecord: z.boolean(),

    // Step 7 — Notices & documents
    noticeLanguage: z.enum(["en", "bn", "both"]),
    deliveryChannels: z.array(z.enum(["sms", "email", "post", "newspaper", "website"])).min(1, "Pick at least one delivery channel"),
    documentsToAttach: z.string().trim().max(400).optional().or(z.literal("")),
    publishToWebsite: z.boolean(),
  })
  .refine((v) => new Date(v.date) >= new Date(v.recordDate), {
    message: "Record date must be on or before the meeting date",
    path: ["recordDate"],
  })
  .refine((v) => new Date(v.votingEnds) > new Date(v.votingStarts), {
    message: "Voting window must end after it starts",
    path: ["votingEnds"],
  })
  .refine((v) => new Date(v.registrationCloses) > new Date(v.registrationOpens), {
    message: "Registration must close after it opens",
    path: ["registrationCloses"],
  });

export type MeetingDraft = z.infer<typeof meetingDraftSchema>;

export const STEP_FIELDS: Record<number, (keyof MeetingDraft)[]> = {
  1: ["companyId", "type", "title", "financialYear", "date", "time", "timezone", "mode", "venue"],
  2: ["recordDate", "shareClassId", "eligibleShareholders", "votingEntitlement", "pollDemandRule", "proxiesAllowed", "corporateRepresentatives"],
  3: ["agenda"],
  4: ["registrationOpens", "registrationCloses", "proxyDeadline", "proxyLimitPerHolder", "verificationWorkflow"],
  5: ["votingMethod", "votingStarts", "votingEnds", "voteConfirmation", "earlyVoting"],
  6: ["streamingProvider", "streamUrl", "zoomMeetingId", "zoomPasscode", "hostName", "moderatorCount", "autoRecord"],
  7: ["noticeLanguage", "deliveryChannels", "documentsToAttach", "publishToWebsite"],
};

export const STEP_TITLES = [
  "Basic information",
  "Shareholder eligibility",
  "Agenda & resolutions",
  "Registration & proxy",
  "Voting configuration",
  "Live meeting",
  "Notices & documents",
  "Review & publish",
] as const;

export const WIZARD_STEPS = STEP_TITLES.length;
