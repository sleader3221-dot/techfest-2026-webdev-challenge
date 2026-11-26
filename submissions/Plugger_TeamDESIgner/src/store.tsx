import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { avatar, albumArt, clubLogo } from "./media";
import { seed } from "./seed";
import type { AppState, User } from "./models";
const key = "plugged_hackathon_v1";
type Edit = (draft: AppState) => void;
function initial() {
  const fresh = seed();
  let warning = "";
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const saved: AppState = JSON.parse(raw);
      if (
        !Object.keys(fresh).every((k) => k in saved) ||
        ![
          "events",
          "users",
          "rsvps",
          "clubs",
          "notifications",
          "photos",
          "activities",
          "unlockedEventIds",
        ].every((k) => Array.isArray(saved[k as keyof AppState])) ||
        !saved.users.some((u) => u.id === saved.currentUserId) ||
        !Number.isFinite(saved.seedAnchor) ||
        !saved.users.every(
          (u) =>
            u.name &&
            Array.isArray(u.interests) &&
            Array.isArray(u.savedEventIds) &&
            Array.isArray(u.followedClubIds) &&
            Array.isArray(u.managedClubIds) &&
            u.socials,
        ) ||
        !saved.clubs.every((c) => c.name && Array.isArray(c.adminUserIds)) ||
        !saved.events.every(
          (e) =>
            e.title &&
            e.venue?.name &&
            e.settings &&
            e.chipIn &&
            Array.isArray(e.vibes) &&
            Array.isArray(e.ticketTiers) &&
            Array.isArray(e.datePollOptions) &&
            Array.isArray(e.coHostUserIds) &&
            Array.isArray(e.promoCodes) &&
            Array.isArray(e.questionnaire) &&
            Number.isFinite(Date.parse(e.startTime)) &&
            Number.isFinite(Date.parse(e.endTime)) &&
            saved.clubs.some((c) => c.id === e.clubId),
        ) ||
        !saved.rsvps.every(
          (r) =>
            r.boops &&
            Array.isArray(r.plusOneNames) &&
            saved.users.some((u) => u.id === r.userId) &&
            saved.events.some((e) => e.id === r.eventId),
        ) ||
        !saved.activities.every(
          (a) =>
            a.boops &&
            Array.isArray(a.replies) &&
            Number.isFinite(Date.parse(a.createdAt)),
        )
      )
        throw Error();
      // Upgrade the original demo artwork while keeping edits, uploads and RSVPs.
      for (const original of fresh.events) {
        const event = saved.events.find(e => e.id === original.id);
        if (event?.isSeed && !event.posterUrl) event.posterUrl = original.posterUrl;
      }
      fresh.users.forEach((original, i) => {
        const user = saved.users.find(u => u.id === original.id);
        if (user?.avatarUrl.startsWith("data:image/svg") && user.avatarUrl === avatar(original.name, i)) user.avatarUrl = original.avatarUrl;
      });
      fresh.clubs.forEach((original, i) => {
        const club = saved.clubs.find(c => c.id === original.id);
        if (club?.logoUrl.startsWith("data:image/svg") && club.logoUrl === clubLogo(i)) club.logoUrl = original.logoUrl;
      });
      fresh.photos.forEach((original, i) => {
        const photo = saved.photos.find(p => p.id === original.id);
        if (photo?.imageDataUrl.startsWith("data:image/svg") && photo.imageDataUrl === albumArt(i)) photo.imageDataUrl = original.imageDataUrl;
      });
      const shift = Date.now() - saved.seedAnchor;
      if (shift > 10800000) {
        const move = (t: string) =>
          new Date(+new Date(t) + shift).toISOString();
        for (const e of saved.events.filter((x) => x.isSeed)) {
          e.startTime = move(e.startTime);
          e.endTime = move(e.endTime);
          e.createdAt = move(e.createdAt);
          for (const p of e.datePollOptions) {
            p.startTime = move(p.startTime);
            p.endTime = move(p.endTime);
          }
        }
        const seeded = new Set(fresh.rsvps.map((r) => r.id));
        for (const r of saved.rsvps.filter((r) => seeded.has(r.id))) {
          r.firstRsvpAt = move(r.firstRsvpAt);
          r.updatedAt = move(r.updatedAt);
        }
        const activity = new Set(fresh.activities.map((a) => a.id));
        for (const a of saved.activities.filter((a) => activity.has(a.id)))
          a.createdAt = move(a.createdAt);
        saved.seedAnchor = Date.now();
      }
      return { state: saved, warning };
    }
  } catch {
    warning = "Stored demo data could not be loaded. A fresh session is ready.";
  }
  return { state: fresh, warning };
}
const ctx = createContext<{
  s: AppState;
  u: User;
  now: number;
  change: (fn: Edit) => void;
  toast: (m: string) => void;
} | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [start] = useState(initial);
  const [s, change] = useReducer((old: AppState, fn: Edit) => {
    const draft = structuredClone(old);
    fn(draft);
    return draft;
  }, start.state);
  const [msg, setMsg] = useState({ text: start.warning, id: 0 });
  const toast = useCallback(
    (text: string) => setMsg((m) => ({ text, id: m.id + 1 })),
    [],
  );
  const [now, tick] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => tick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = s.themePref;
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {
      toast(
        "Storage is unavailable or full. Changes will last for this session.",
      );
    }
  }, [s, toast]);
  useEffect(() => {
    if (msg.text) {
      const t = setTimeout(() => setMsg((m) => ({ ...m, text: "" })), 4000);
      return () => clearTimeout(t);
    }
  }, [msg]);
  return (
    <ctx.Provider
      value={{
        s,
        u: s.users.find((x) => x.id === s.currentUserId)!,
        now,
        change,
        toast,
      }}
    >
      {children}
      <div aria-live="polite" className="toast-area">
        {msg.text && <div className="toast">{msg.text}</div>}
      </div>
    </ctx.Provider>
  );
}
export function useApp() {
  const state = useContext(ctx);
  if (!state) throw Error("Missing provider");
  return state;
}
