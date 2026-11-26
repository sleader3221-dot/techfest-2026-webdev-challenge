import type { AppState, CampusEvent, RsvpRecord, RsvpStatus } from "./models";

export const uid = () => crypto.randomUUID();
export const stamp = () => new Date().toISOString();
export const when = (time: string) =>
  new Date(time).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
export const overlaps = (a: CampusEvent, b: CampusEvent) =>
  a.id !== b.id &&
  !a.isPollMode &&
  !b.isPollMode &&
  a.startTime < b.endTime &&
  b.startTime < a.endTime;
export const seats = (r: RsvpRecord) => 1 + r.plusOneNames.length;
export const passCode = (r: RsvpRecord) =>
  ["PLUGGED", r.eventId, r.userId, r.id].join(":");
export function passImage(code: string) {
  // Deterministic visual pass. Check-in uses the printed payload, not an optical QR scanner.
  let hash = 1234567;
  for (const c of code) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const cells: string[] = [];
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 21; x++) {
      const corner = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
      const a = x > 12 ? x - 14 : x,
        b = y > 12 ? y - 14 : y;
      hash ^= hash << 13;
      hash ^= hash >>> 17;
      hash ^= hash << 5;
      if (
        corner
          ? a >= 0 &&
            b >= 0 &&
            a < 7 &&
            b < 7 &&
            (a === 0 ||
              a === 6 ||
              b === 0 ||
              b === 6 ||
              (a >= 2 && a <= 4 && b >= 2 && b <= 4))
          : hash & 1
      )
        cells.push(`M${x + 3} ${y + 3}h1v1h-1z`);
    }
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 27" shape-rendering="crispEdges"><rect width="27" height="27" fill="white"/><path d="${cells.join("")}" /></svg>`,
    )
  );
}
export function notify(
  s: AppState,
  userId: string,
  eventId: string,
  title: string,
  message: string,
) {
  s.notifications.unshift({
    id: uid(),
    userId,
    eventId,
    title,
    message,
    createdAt: stamp(),
    read: false,
  });
}
export function activity(s: AppState, eventId: string, text: string) {
  s.activities.push({
    id: uid(),
    eventId,
    userId: s.currentUserId,
    type: "system",
    text,
    createdAt: stamp(),
    boops: {},
    replies: [],
  });
}
type Details = Partial<
  Pick<
    RsvpRecord,
    | "plusOneNames"
    | "questionnaireAnswers"
    | "ticketTierId"
    | "promoCodeUsed"
    | "amountPaidInr"
    | "chipInConfirmed"
  >
> & { host?: boolean };
export function updateRsvp(
  s: AppState,
  eventId: string,
  userId: string,
  requested: RsvpStatus,
  options: Details = {},
) {
  const event = s.events.find((e) => e.id === eventId)!;
  const guests = s.rsvps.filter((r) => r.eventId === eventId);
  let r = guests.find((g) => g.userId === userId);
  const prev = r?.status,
    prevSeats = r && prev === "going" ? seats(r) : 0;
  const before = guests
    .filter((g) => g.status === "going")
    .reduce((n, g) => n + seats(g), 0);
  const { host, ...details } = options;
  if (!r) {
    r = {
      id: uid(),
      eventId,
      userId,
      status: requested,
      firstRsvpAt: stamp(),
      updatedAt: stamp(),
      plusOneNames: [],
      questionnaireAnswers: {},
      amountPaidInr: 0,
      chipInConfirmed: false,
      checkedIn: false,
      boops: {},
    };
    s.rsvps.push(r);
  }
  Object.assign(r, details);
  let status = requested;
  if (requested === "going" && !host) {
    if (event.settings.requireApproval && prev !== "going") status = "pending";
    else if (
      before - prevSeats + seats(r) >
      (event.settings.capacity ?? Infinity)
    )
      status = "waitlist";
  }
  if (status === "waitlist" && prev !== "waitlist") r.firstRsvpAt = stamp();
  r.status = status;
  r.updatedAt = stamp();
  if (status !== "going") {
    r.checkedIn = false;
    delete r.checkedInAt;
  }
  const name = s.users.find((user) => user.id === userId)?.name ?? "Guest";
  activity(s, eventId, `${name} · ${labels[status]}`);
  if (host)
    notify(
      s,
      userId,
      eventId,
      event.title,
      `Your RSVP is now ${labels[status].toLowerCase()}.`,
    );
  let occupied = before - prevSeats + (status === "going" ? seats(r) : 0);
  if (occupied < before)
    for (const g of guests
      .filter((g) => g.status === "waitlist" && g.id !== r.id)
      .sort((a, b) => a.firstRsvpAt.localeCompare(b.firstRsvpAt))) {
      if (occupied + seats(g) > (event.settings.capacity ?? Infinity)) break;
      const tier = event.ticketTiers.find((t) => t.id === g.ticketTierId);
      if (
        tier &&
        s.rsvps
          .filter(
            (v) =>
              v.eventId === eventId &&
              v.status === "going" &&
              v.ticketTierId === tier.id,
          )
          .reduce((n, v) => n + seats(v), 0) +
          seats(g) >
          tier.capacity
      )
        break;
      g.status = "going";
      g.updatedAt = stamp();
      occupied += seats(g);
      notify(
        s,
        g.userId,
        eventId,
        event.title,
        "A place opened up. You are going!",
      );
      activity(
        s,
        eventId,
        `${s.users.find((v) => v.id === g.userId)?.name} moved off the waitlist.`,
      );
    }
  event.ticketTiers.forEach((t) => {
    t.soldCount = s.rsvps
      .filter(
        (g) =>
          g.eventId === eventId &&
          g.status === "going" &&
          g.ticketTierId === t.id,
      )
      .reduce((n, g) => n + seats(g), 0);
  });
  return status;
}
export const labels: Record<RsvpStatus, string> = {
  going: "Going",
  maybe: "Maybe",
  cant_go: "Can't go",
  waitlist: "Waitlist",
  pending: "Pending approval",
  declined: "Declined",
};
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const calTime = (t: string) =>
  new Date(t)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
export function googleCalendar(e: CampusEvent) {
  return (
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: e.title,
      dates: calTime(e.startTime) + "/" + calTime(e.endTime),
      details: e.description,
      location: e.venue.name,
    })
  );
}
export function downloadIcs(e: CampusEvent) {
  const esc = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/([,;])/g, "\\$1");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plugged RIT//EN",
    "BEGIN:VEVENT",
    "UID:" + e.id + "@plugged.rit",
    "DTSTAMP:" + calTime(stamp()),
    "DTSTART:" + calTime(e.startTime),
    "DTEND:" + calTime(e.endTime),
    "SUMMARY:" + esc(e.title),
    "DESCRIPTION:" + esc(e.description),
    "LOCATION:" + esc(e.venue.name),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const enc = new TextEncoder();
  const folded =
    lines
      .map((line) => {
        let part = "",
          count = 0;
        for (const char of line) {
          const bytes = enc.encode(char).length;
          if (count + bytes > 75) {
            part += "\r\n ";
            count = 1;
          }
          part += char;
          count += bytes;
        }
        return part;
      })
      .join("\r\n") + "\r\n";
  saveFile(
    new Blob([folded], { type: "text/calendar;charset=utf-8" }),
    e.id + ".ics",
  );
}
export function downloadCsv(e: CampusEvent, s: AppState) {
  const header = [
    "Name",
    "USN",
    "Email",
    "Status",
    "Plus Ones",
    "Ticket Tier",
    "Promo Code",
    "Paid (INR)",
    "Chip-In Confirmed",
    "Checked In",
    "First RSVP Time",
    ...e.questionnaire.map((q) => q.label),
  ];
  const rows = s.rsvps
    .filter((g) => g.eventId === e.id)
    .map((g) => {
      const u = s.users.find((v) => v.id === g.userId)!;
      return [
        u.name,
        u.usn,
        u.email,
        g.status,
        g.plusOneNames.join(", "),
        e.ticketTiers.find((t) => t.id === g.ticketTierId)?.name,
        g.promoCodeUsed,
        g.amountPaidInr,
        g.chipInConfirmed,
        g.checkedIn,
        g.firstRsvpAt,
        ...e.questionnaire.map((q) => g.questionnaireAnswers[q.id]),
      ];
    });
  const escape = (v: unknown) => {
    const str = String(v ?? "");
    return (
      '"' +
      (/^[=+@\-\t\r]/.test(str) ? "'" : "") +
      str.replace(/"/g, '""') +
      '"'
    );
  };
  saveFile(
    new Blob(
      [
        "\uFEFF",
        [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-guests.csv",
  );
}
export async function resizeImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height)),
      c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Image processing is unavailable.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
