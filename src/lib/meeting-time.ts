/** Convert wizard wall-clock input in its selected IANA timezone, independent of the server timezone. */
export function meetingTimeToIso(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid meeting date and time");
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wallTime);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) throw new Error("Enter a valid meeting date and time");
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  let timestamp = wallTime;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((p) => [p.type, Number(p.value)]));
    const displayed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    if (displayed === wallTime) return new Date(timestamp).toISOString();
    timestamp += wallTime - displayed;
  }
  throw new Error("This time does not exist in the selected timezone");
}
