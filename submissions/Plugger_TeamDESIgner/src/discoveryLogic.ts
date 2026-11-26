import type { AppState, CampusEvent, User } from "./models";
export const categories = [
  "Tech",
  "Cultural",
  "Sports",
  "Workshop",
  "Recruitment",
  "Social",
];
export const vibes = [
  "Chill",
  "Learn Something",
  "Get Active",
  "Meet People",
  "Late Night",
];
export const date = (
  v: string,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  },
) => new Intl.DateTimeFormat("en-IN", opts).format(new Date(v));
export function status(e: CampusEvent, now: number) {
  if (e.isPollMode) return "Date poll open";
  if (+new Date(e.endTime) < now) return "Ended";
  const mins = Math.ceil((+new Date(e.startTime) - now) / 60000);
  return mins <= 0 ? "Live now" : mins <= 180 ? "Starting soon" : "Upcoming";
}
export function timeOrder(a: CampusEvent, b: CampusEvent) {
  return (
    a.startTime.localeCompare(b.startTime) ||
    a.venue.distanceMinutesFromCenter - b.venue.distanceMinutesFromCenter
  );
}
export function mutuals(s: AppState, u: User) {
  const attended = new Set(
    s.rsvps
      .filter((r) => r.userId === u.id && r.status === "going")
      .map((r) => r.eventId),
  );
  return s.users.filter(
    (v) =>
      v.id !== u.id &&
      s.rsvps.some(
        (r) =>
          r.userId === v.id && r.status === "going" && attended.has(r.eventId),
      ),
  );
}
export function rank(
  s: AppState,
  u: User,
  e: CampusEvent,
  now: number,
  mut: Set<string>,
) {
  const near = status(e, now);
  const follow = u.followedClubIds.includes(e.clubId),
    interest = u.interests.includes(e.category);
  const count = s.rsvps.filter(
    (r) => r.eventId === e.id && r.status === "going" && mut.has(r.userId),
  ).length;
  return {
    score:
      (follow ? 40 : 0) +
      (interest ? 25 : 0) +
      Math.min(45, count * 15) +
      (near === "Live now" ? 30 : near === "Starting soon" ? 20 : 0) +
      (+new Date(e.startTime) - now < 172800000 ? 10 : 0),
    reason: follow
      ? "You follow " + s.clubs.find((c) => c.id === e.clubId)?.name
      : interest
        ? "Matches your interest in " + e.category
        : count
          ? "Your mutuals are going"
          : "Around campus",
  };
}
