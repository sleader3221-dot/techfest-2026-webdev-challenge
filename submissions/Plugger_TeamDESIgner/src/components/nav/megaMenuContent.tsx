import type { AppState, CampusEvent, User } from "../../models";
import {
  categories,
  vibes,
  status,
  timeOrder,
  date,
} from "../../discoveryLogic";
import { downloadIcs, overlaps } from "../../hubTools";
import { mutualIds } from "../../hubSocial";
import { poster } from "../../media";

export const destinations = [
  ["Discover", "/"],
  ["Pulse", "/pulse"],
  ["Clubs", "/clubs"],
  ["Calendar", "/calendar"],
  ["Organizer", "/organizer"],
  ["Profile", "/profile"],
] as const;
export type Item = {
  label: string;
  to?: string;
  action?: () => void;
  detail?: string;
  image?: string;
};
type Column = { title: string; items: Item[]; empty?: string };
type Feature = {
  label: string;
  title: string;
  body: string;
  image: string;
  links: Item[];
  stats?: [number, string][];
  live?: boolean;
};
export type Menu = { columns: Column[]; feature: Feature };
const link = (label: string, to: string, detail?: string): Item => ({
  label,
  to,
  detail,
});
const col = (title: string, items: Item[], empty?: string): Column => ({
  title,
  items,
  empty,
});
const eventUrl = (e: CampusEvent) => "/events/" + e.id;
const walk = (e: CampusEvent) =>
  e.venue.name + " · " + e.venue.distanceMinutesFromCenter + " min walk";
const eventCard = (e: CampusEvent, label: string, live = false): Feature => ({
  label,
  title: e.title,
  body: walk(e),
  image: poster(e),
  links: [link("See details", eventUrl(e))],
  live,
});
const icon = "/assets/brand/icon-192.png";
const fallback: Feature = {
  label: "Discover",
  title: "Explore campus events",
  body: "Find a club event to add to your plans.",
  image: icon,
  links: [link("Browse all events", "/?tab=all")],
};
export function buildMenus(
  s: AppState,
  u: User,
  now: number,
  actions: { theme: () => void; demo: () => void; organize: () => void },
): Menu[] {
  const visible = s.events
    .filter(
      (e) =>
        e.settings.isPublic ||
        s.activeRole === "organizer" ||
        e.hostUserId === u.id ||
        e.coHostUserIds.includes(u.id) ||
        s.unlockedEventIds.includes(u.id + ":" + e.id),
    )
    .sort(timeOrder);
  const live = visible.filter((e) => status(e, now) === "Live now"),
    soon = visible.filter((e) => status(e, now) === "Starting soon");
  const nearest = (list: CampusEvent[]) =>
    [...list].sort(
      (a, b) =>
        a.venue.distanceMinutesFromCenter - b.venue.distanceMinutesFromCenter ||
        timeOrder(a, b),
    )[0];
  const featured =
    nearest(live) ??
    visible.find((e) => !e.isPollMode && Date.parse(e.startTime) > now);
  const closest = nearest([...live, ...soon]);
  const minutes = (time: string) => Math.ceil((Date.parse(time) - now) / 60000);
  const tab = (name: string, value: string) => link(name, "/?tab=" + value);
  const discover: Menu = {
    columns: [
      col("Browse", [
        link("Open Discover", "/"),
        tab("For you", "for-you"),
        tab("All events", "all"),
        tab("Following", "following"),
        tab("Saved", "saved"),
      ]),
      col(
        "Category",
        categories.map((c) => link(c, "/?category=" + c)),
      ),
      col(
        "Vibe",
        vibes.map((v) => link(v, "/?vibe=" + encodeURIComponent(v))),
      ),
      col(
        "When",
        ["Happening now", "Today / tonight", "This week", "This weekend"].map(
          (v, i) => link(v, "/?when=" + ["now", "today", "week", "weekend"][i]),
        ),
      ),
    ],
    feature: featured
      ? eventCard(
          featured,
          live.length ? "Live now" : "Coming up",
          !!live.length,
        )
      : fallback,
  };
  const pulse: Menu = {
    columns: [
      col("Shortcuts", [
        link("Open Pulse", "/pulse"),
        tab("Browse all events", "all"),
      ]),
      col(
        "Live now",
        live
          .slice(0, 3)
          .map((e) => link(e.title, eventUrl(e), "● Live · " + e.venue.name)),
        "Nothing live right now",
      ),
      col(
        "Starting soon",
        soon
          .slice(0, 3)
          .map((e) =>
            link(
              e.title,
              eventUrl(e),
              "Starts in " + minutes(e.startTime) + "m",
            ),
          ),
        "No starts in the next three hours",
      ),
    ],
    feature: closest
      ? {
          ...eventCard(closest, "Closest on campus"),
          title: live.includes(closest)
            ? minutes(closest.endTime) + "m left"
            : "In " + minutes(closest.startTime) + "m",
          body: closest.title + " · " + walk(closest),
          links: [
            link("See details", eventUrl(closest)),
            { label: "Add to calendar", action: () => downloadIcs(closest) },
          ],
        }
      : fallback,
  };
  const upcoming = (id: string) =>
    visible.filter(
      (e) => e.clubId === id && (e.isPollMode || Date.parse(e.startTime) > now),
    ).length;
  const popular = [...s.clubs].sort(
    (a, b) => upcoming(b.id) - upcoming(a.id),
  )[0];
  const clubs: Menu = {
    columns: [
      col("Clubs", [
        link("Open Clubs", "/clubs"),
        ...s.clubs.map((c) => ({
          ...link(c.name, "/clubs/" + c.id, c.category),
          image: c.logoUrl,
        })),
      ]),
      col(
        "Browse by category",
        categories.map((c) => link(c, "/clubs?category=" + c)),
      ),
      col(
        "Your clubs",
        s.clubs
          .filter((c) => u.followedClubIds.includes(c.id))
          .map((c) => link(c.name, "/clubs/" + c.id)),
        "You’re not following any clubs yet",
      ),
    ],
    feature: popular
      ? {
          label: u.followedClubIds.includes(popular.id)
            ? "Following"
            : "Club spotlight",
          title: popular.name,
          body:
            popular.memberCount +
            " members · " +
            upcoming(popular.id) +
            " upcoming events",
          image: popular.logoUrl,
          links: [
            link(
              u.followedClubIds.includes(popular.id)
                ? "View club"
                : "Follow club",
              "/clubs/" + popular.id,
            ),
          ],
        }
      : fallback,
  };
  const going = s.events
    .filter(
      (e) =>
        s.rsvps.some(
          (r) =>
            r.userId === u.id && r.eventId === e.id && r.status === "going",
        ) && !e.isPollMode,
    )
    .sort(timeOrder);
  const next = going.filter((e) => Date.parse(e.startTime) >= now);
  const clashes = going.reduce(
    (n, e, i) =>
      n + going.slice(i + 1).filter((other) => overlaps(e, other)).length,
    0,
  );
  const calendar: Menu = {
    columns: [
      col("Views", [
        link("Open Calendar", "/calendar"),
        ...["Week", "Month", "Today"].map((t) => link(t, "/calendar")),
      ]),
      col(
        "Your next up",
        next
          .slice(0, 3)
          .map((e) => link(e.title, eventUrl(e), date(e.startTime))),
        "No upcoming RSVPs",
      ),
      col(
        "Heads up",
        clashes
          ? [
              link(
                "Schedule clashes",
                "/calendar",
                clashes + " " + (clashes === 1 ? "clash" : "clashes"),
              ),
            ]
          : [],
        "No clashes",
      ),
    ],
    feature: next[0]
      ? {
          ...eventCard(next[0], "Next on your calendar"),
          links: [
            link("See details", eventUrl(next[0])),
            { label: "Download .ics", action: () => downloadIcs(next[0]) },
          ],
        }
      : fallback,
  };
  const managed = "/organizer?tab=managed";
  const organizer: Menu = {
    columns: [
      col("Create", [
        link("Open Organizer", "/organizer"),
        link("Create event", "/organizer"),
        link("Start a date poll", "/organizer"),
      ]),
      col("Manage", [
        link("My managed events", managed),
        link("Club profile editor", "/organizer?tab=club"),
      ]),
      col(
        "Event tools",
        ["Check-in", "Export guest CSV", "Send a text blast"].map((t) =>
          link(t, managed),
        ),
      ),
    ],
    feature: {
      label: "Organizer studio",
      title: "Host in 10 seconds",
      body: "Choose a venue, set a date and invite your club.",
      image: icon,
      links: [
        link("Create event", "/organizer"),
        ...(s.activeRole === "student"
          ? [{ label: "Switch to Organizer", action: actions.organize }]
          : []),
      ],
    },
  };
  const people = mutualIds(s, u.id);
  const profile: Menu = {
    columns: [
      col(
        "You",
        [
          "Open Profile",
          "My profile",
          "My QR passes",
          "Saved events",
          "Past events",
        ].map((t) => link(t, "/profile")),
      ),
      col(
        "Mutuals",
        people
          .slice(0, 3)
          .map(({ user, count }) => ({
            ...link(
              user.name,
              "/profile",
              count + " shared " + (count === 1 ? "event" : "events"),
            ),
            image: user.avatarUrl,
          })),
        "No shared events yet",
      ),
      col("Quick settings", [
        { label: "Toggle theme", action: actions.theme },
        { label: "Open demo controls", action: actions.demo },
      ]),
    ],
    feature: {
      label: "Your profile",
      title: u.name,
      body: u.usn,
      image: u.avatarUrl,
      links: [link("View profile", "/profile")],
      stats: [
        [going.filter((e) => Date.parse(e.endTime) < now).length, "Attended"],
        [
          s.events.filter(
            (e) => e.hostUserId === u.id || e.coHostUserIds.includes(u.id),
          ).length,
          "Hosted",
        ],
        [u.followedClubIds.length, "Clubs"],
        [people.length, "Mutuals"],
      ],
    },
  };
  return [discover, pulse, clubs, calendar, organizer, profile];
}
