import { describe, expect, it } from "vitest";
import { meetingTimeToIso } from "./meeting-time";
describe("meeting deadlines in the selected timezone", () => {
  it("converts Dhaka, Kolkata and UTC without using the server timezone", () => {
    expect(meetingTimeToIso("2026-12-09T17:00", "Asia/Dhaka")).toBe("2026-12-09T11:00:00.000Z");
    expect(meetingTimeToIso("2026-12-09T17:00", "Asia/Kolkata")).toBe("2026-12-09T11:30:00.000Z");
    expect(meetingTimeToIso("2026-12-09T17:00", "UTC")).toBe("2026-12-09T17:00:00.000Z");
  });
  it("rejects malformed inputs and unknown timezones", () => {
    expect(() => meetingTimeToIso("not-a-time", "Asia/Dhaka")).toThrow();
    expect(() => meetingTimeToIso("2026-02-30T17:00", "Asia/Dhaka")).toThrow();
    expect(() => meetingTimeToIso("2026-12-09T17:00", "Unknown/Zone")).toThrow();
  });
});
