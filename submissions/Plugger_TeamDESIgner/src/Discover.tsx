import { ChatHeroDemo } from "./components/landing/ChatHeroDemo";
import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { useApp } from "./store";
import type { CampusEvent, Club as ClubModel } from "./models";
import { poster } from "./media";
import { Dialog, Icon, Segments } from "./ui";
import {
  categories,
  vibes,
  date,
  timeOrder,
  status,
  rank,
  mutuals,
} from "./discoveryLogic";
import { downloadIcs } from "./hubTools";

export function EventCard({ e, reason }: { e: CampusEvent; reason?: string }) {
  const { s, u, now, change } = useApp();
  const club = s.clubs.find((c) => c.id === e.clubId)!;
  const saved = u.savedEventIds.includes(e.id);
  const guests = s.rsvps.filter(
    (r) => r.eventId === e.id && r.status === "going",
  );
  const friends = mutuals(s, u).filter((f) =>
    guests.some((g) => g.userId === f.id),
  );
  const own = s.rsvps.find((r) => r.eventId === e.id && r.userId === u.id);
  return (
    <article data-component="event-card">
      <div className="tile-img" data-slot="poster">
        <Link to={"/events/" + e.id} aria-label={e.title}>
          <img loading="lazy" alt="" src={poster(e)} />
        </Link>
        <span className="badge floating" data-slot="status">
          {status(e, now)}
        </span>
        <button
          className="circle save"
          aria-pressed={saved}
          aria-label={(saved ? "Unsave " : "Save ") + e.title}
          onClick={() =>
            change((d) => {
              const v = d.users.find((x) => x.id === u.id)!;
              v.savedEventIds = saved
                ? v.savedEventIds.filter((x) => x !== e.id)
                : [...v.savedEventIds, e.id];
            })
          }
        >
          <Icon name="save" filled={saved} />
        </button>
      </div>
      <div className="card-copy">
        <small data-slot="meta">
          {e.category} / {e.vibes.join(" · ")}
        </small>
        <h3 data-slot="title">
          <Link to={"/events/" + e.id}>{e.title}</Link>
        </h3>
        <Link data-slot="club" className="muted" to={"/clubs/" + club.id}>
          {club.name}
        </Link>
        <p data-slot="datetime">
          <Icon name="clock" size={15} />
          {e.isPollMode ? "Voting open" : date(e.startTime)}
        </p>
        <p data-slot="venue">
          <Icon name="map" size={15} />
          {e.venue.name}
        </p>
        {(!e.settings.hideGuestCount ||
          s.activeRole === "organizer" ||
          e.hostUserId === u.id) && (
          <p data-slot="attendees">
            {guests.reduce((n, g) => n + 1 + g.plusOneNames.length, 0)} going{" "}
            {friends.length > 0 &&
              !e.settings.anonymizeGuestList &&
              " · " +
                friends
                  .slice(0, 2)
                  .map((friend) => friend.name.split(" ")[0])
                  .join(", ") +
                (friends.length > 2 ? " +" + (friends.length - 2) : "")}
          </p>
        )}
        {own && <span className="badge" data-tone={own.status === "going" ? "going" : "neutral"}>{own.status === "going" && <span aria-hidden="true">✓ </span>}{own.status.replace("_", " ")}</span>}
        {reason && (
          <small data-slot="reason" className="reason">
            {reason}
          </small>
        )}
      </div>
    </article>
  );
}
function LiveCard({ e }: { e: CampusEvent }) {
  const { s } = useApp();
  return (
    <Link className="live-card" to={"/events/" + e.id}>
      <div className="live-image">
        <img src={poster(e)} alt="" />
      </div>
      <div className="live-copy">
        <div className="live-meta">
          <span className="live-tag">
            <i />
            Live now
          </span>
          <span>{e.category}</span>
        </div>
        <h3>{e.title}</h3>
        <p>{s.clubs.find((c) => c.id === e.clubId)?.name}</p>
        <div className="venue">
          <Icon name="map" size={14} />
          {e.venue.name} · {e.venue.distanceMinutesFromCenter} min walk
        </div>
      </div>
      <span className="open-arrow">
        <Icon name="out" size={16} />
      </span>
    </Link>
  );
}
const initialFilters = {
  category: "",
  club: "",
  price: "",
  window: "",
  vibe: [] as string[],
};
function Feed() {
  const { s, u, now } = useApp();
  const [query, setQuery] = useState(""),
    [term, setTerm] = useState(""),
    [filters, setFilters] = useState(initialFilters),
    [open, setFiltersOpen] = useState(false),
    [tab, setTab] = useState("For You"),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabs: Record<string, string> = {
      "for-you": "For You",
      all: "All events",
      following: "Following",
      saved: "Saved",
    };
    const windows: Record<string, string> = {
      now: "Happening now",
      today: "Today / tonight",
      week: "This week",
      weekend: "Weekend",
    };
    const tabKey = params.get("tab") || "";
    const whenKey = params.get("when") || "";
    const selectedTab = Object.hasOwn(tabs, tabKey) ? tabs[tabKey] : "";
    const windowFilter = Object.hasOwn(windows, whenKey)
      ? windows[whenKey]
      : "";
    const category = categories.find((c) => c === params.get("category")) || "";
    const vibe = vibes.find((v) => v === params.get("vibe"));
    if (location.search && !selectedTab && !windowFilter && !category && !vibe)
      return;
    setTab(selectedTab || "For You");
    setFilters({
      ...initialFilters,
      category,
      window: windowFilter,
      vibe: vibe ? [vibe] : [],
    });
    setTerm("");
    setQuery("");
    if (selectedTab || category || vibe || windowFilter) {
      const frame = requestAnimationFrame(() =>
        document
          .getElementById("discover-feed")
          ?.scrollIntoView({ behavior: "instant" }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [location.search]);
  const count =
    Number(!!filters.category) +
    Number(!!filters.club) +
    Number(!!filters.price) +
    Number(!!filters.window) +
    filters.vibe.length;
  const reset = () => {
    setFilters(initialFilters);
    setQuery("");
    setTerm("");
  };
  const matches = useMemo(() => {
    const people = new Set(mutuals(s, u).map((x) => x.id));
    return s.events
      .filter((e) => {
        const st = status(e, now),
          d = new Date(e.startTime),
          end = new Date(e.endTime);
        const club = s.clubs.find((c) => c.id === e.clubId)!;
        if (
          !e.settings.isPublic &&
          s.activeRole !== "organizer" &&
          e.hostUserId !== u.id &&
          !e.coHostUserIds.includes(u.id) &&
          !s.unlockedEventIds.includes(u.id + ":" + e.id)
        )
          return false;
        return (
          (!filters.category || filters.category === e.category) &&
          (!filters.club || filters.club === e.clubId) &&
          (!filters.price || (filters.price === "Free") === e.isFree) &&
          filters.vibe.every((v) => e.vibes.some((a) => a === v)) &&
          (!filters.window ||
            (filters.window === "Happening now"
              ? st === "Live now"
              : filters.window === "Today / tonight"
                ? d.toDateString() === new Date(now).toDateString() ||
                  st === "Live now"
                : filters.window === "This week"
                  ? +end >= now && +d < now + 7 * 86400000
                  : [0, 6].includes(d.getDay()) && +end >= now)) &&
          [e.title, e.description, e.venue.name, e.venue.building, club.name]
            .join(" ")
            .toLowerCase()
            .includes(term) &&
          (tab === "For You"
            ? st !== "Ended"
            : tab === "Following"
              ? u.followedClubIds.includes(e.clubId)
              : tab === "Saved"
                ? u.savedEventIds.includes(e.id)
                : true)
        );
      })
      .map((e) => ({ e, ...rank(s, u, e, now, people) }))
      .sort((a, b) =>
        tab === "For You"
          ? b.score - a.score || timeOrder(a.e, b.e)
          : timeOrder(a.e, b.e),
      );
  }, [s, u, now, filters, tab, term]);
  const fields = (
    <>
      <div className="filter-fields">
        {(
          [
            ["category", "Category", categories],
            [
              "window",
              "Date",
              ["Happening now", "Today / tonight", "This week", "Weekend"],
            ],
            ["club", "Club", s.clubs.map((c) => c.id)],
            ["price", "Price", ["Free", "Paid / Chip-In"]],
          ] as const
        ).map(([field, label, options]) => (
          <label key={field}>
            {label}
            <select
              aria-label={label}
              value={filters[field]}
              onChange={(e) =>
                setFilters({ ...filters, [field]: e.target.value })
              }
            >
              <option value="">
                {
                  {
                    category: "All categories",
                    window: "Any date",
                    club: "All clubs",
                    price: "Any price",
                  }[field]
                }
              </option>
              {options.map((o) => (
                <option value={o} key={o}>
                  {field === "club" ? s.clubs.find((c) => c.id === o)?.name : o}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="row">
        {vibes.map((v) => (
          <button
            key={v}
            data-component="chip" aria-pressed={filters.vibe.includes(v)}
            onClick={() =>
              setFilters({
                ...filters,
                vibe: filters.vibe.includes(v)
                  ? filters.vibe.filter((x) => v !== x)
                  : [...filters.vibe, v],
              })
            }
          >
            {v}
          </button>
        ))}
        <button onClick={reset}>Clear filters</button>
      </div>
    </>
  );
  return (
    <section className="wrap band" id="discover-feed">
      <div className="section-title">
        <h2>Discover events</h2>
        <span className="muted">{matches.length} events</span>
      </div>
      <div className="filter-bar">
        <div className="feed-tools" data-component="feed-toolbar">
          <Segments tabs
            items={["For You", "All events", "Following", "Saved"]}
            value={tab}
            select={setTab}
          />
          <div className="search">
            <Icon name="search" />
            <input
              aria-label="Search events"
              placeholder="Search events"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className="filter-launch"
            onClick={() => setFiltersOpen(!open)}
            aria-expanded={open}
          >
            <Icon name="controls" />
            Filters {count > 0 && "(" + count + ")"}
          </button>
        </div>
        <details className="desktop-filters">
          <summary>Explore filters {count > 0 && "(" + count + ")"}</summary>
          {fields}
        </details>
      </div>
      {open && (
        <Dialog title="Filter events" onClose={() => setFiltersOpen(false)}>
          {fields}
          <button className="primary" onClick={() => setFiltersOpen(false)}>
            Show {matches.length} events
          </button>
        </Dialog>
      )}
      {loading ? (
        <div className="grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      ) : matches.length ? (
        <div className="grid">
          {matches.map(({ e, reason }) => (
            <EventCard
              key={e.id}
              e={e}
              reason={tab === "For You" ? reason : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="panel">
          <h3>Nothing matches</h3>
          <p>Try another search or explore all events.</p>
          <button
            onClick={() => {
              reset();
              setTab("All events");
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </section>
  );
}
export function Home() {
  const { s, now } = useApp();
  const live = s.events
    .filter((e) => e.settings.isPublic && status(e, now) === "Live now")
    .sort(timeOrder);
  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="little-line" data-slot="eyebrow-rule" /> RIT CAMPUS / BENGALURU
            </div>
            <h1>
              What’s on
              <br />
              at RIT<span className="hero-dot" data-slot="hero-dot">.</span>
            </h1>
            <p>Find your people, your clubs, and your next campus event.</p>
            <div className="row">
              <a href="#live" className="btn primary">
                <Icon name="pulse" />
                See what’s live
              </a>
              <Link className="btn secondary" to="/clubs">
                Browse clubs
                <Icon name="out" size={16} />
              </Link>
            </div>
          </div>
          <ChatHeroDemo />
        </div>
      </section>
      <section data-component="pulse-strip" id="live">
        <div className="wrap band">
          <div className="section-title">
            <div className="row">
              <span className="pulse-symbol">
                <Icon name="pulse" size={24} />
              </span>
              <h2>Happening now</h2>
              <span className="count" data-component="badge" data-tone="count">
                {String(live.length).padStart(2, "0")}
              </span>
            </div>
            <Link className="text-link" to="/pulse">
              View pulse <Icon name="out" size={15} />
            </Link>
          </div>
          <div className="live-grid">
            {live.map((e) => (
              <LiveCard key={e.id} e={e} />
            ))}
            {!live.length && <p>No events are live right now.</p>}
          </div>
        </div>
      </section>
      <Feed />
    </>
  );
}
export function Pulse() {
  const { s, now } = useApp();
  const sorted = s.events.filter((e) => e.settings.isPublic).sort(timeOrder);
  const live = sorted.filter((e) => status(e, now) === "Live now"),
    soon = sorted.filter((e) => status(e, now) === "Starting soon");
  const first = live[0];
  return (
    <div className="wrap band stack">
      <span className="eyebrow">Campus activity</span>
      <h1>Pulse</h1>
      <h2>Happening now</h2>
      {first && (
        <article className="featured">
          <img src={poster(first)} alt="" />
          <div className="stack">
            <span className="eyebrow">
              Live · Ends in{" "}
              {Math.ceil((+new Date(first.endTime) - now) / 60000)} min
            </span>
            <h2>{first.title}</h2>
            <p>{first.description}</p>
            <p>
              {first.venue.name} · {first.venue.distanceMinutesFromCenter} min
              walk
            </p>
            <div className="row">
              <Link
                className="btn primary"
                to={"/events/" + first.id + "?rsvp=going"}
              >
                RSVP
              </Link>
              <button onClick={() => downloadIcs(first)}>
                Add to calendar
              </button>
            </div>
          </div>
        </article>
      )}
      <div className="live-grid">
        {live.slice(1).map((e) => (
          <LiveCard e={e} key={e.id} />
        ))}
      </div>
      {!live.length && (
        <p>
          No live events. <Link to="/">Browse events</Link>
        </p>
      )}
      <h2>Starting soon</h2>
      <p className="muted">In the next three hours</p>
      <div className="grid">
        {soon.map((e) => (
          <EventCard e={e} key={e.id} />
        ))}
      </div>
      {!soon.length && <Link to="/">Browse all events</Link>}
    </div>
  );
}
function Follow({ c }: { c: ClubModel }) {
  const { u, change, toast } = useApp();
  const on = u.followedClubIds.includes(c.id);
  return (
    <button
      aria-pressed={on}
      onClick={() => {
        change((d) => {
          const v = d.users.find((x) => x.id === u.id)!;
          v.followedClubIds = on
            ? v.followedClubIds.filter((id) => id !== c.id)
            : [...v.followedClubIds, c.id];
          d.clubs.find((x) => x.id === c.id)!.memberCount += on ? -1 : 1;
        });
        toast(on ? "Unfollowed " + c.name : "Following " + c.name);
      }}
    >
      {on ? "Following" : "Follow club"}
    </button>
  );
}
export function Clubs() {
  const { s, now } = useApp();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("");
  const location = useLocation();
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("category");
    setCategory(categories.find((c) => c === value) || "");
  }, [location.search]);
  const clubs = s.clubs.filter(
    (c) =>
      (!category || category === c.category) &&
      [c.name, c.description]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="wrap band stack">
      <span className="eyebrow">Campus directory</span>
      <h1>Clubs at RIT</h1>
      <div className="row">
        <input
          aria-label="Search clubs"
          placeholder="Search clubs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Club category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className="grid">
        {clubs.map((c) => (
          <article
            data-component="club-card"
            className="panel stack"
            key={c.id}
          >
            <img className="club-logo" src={c.logoUrl} alt="" />
            <span className="eyebrow">{c.category}</span>
            <h2>
              <Link to={"/clubs/" + c.id}>{c.name}</Link>
            </h2>
            <p>{c.description}</p>
            <small>
              {c.memberCount} members ·{" "}
              {
                s.events.filter(
                  (e) =>
                    e.clubId === c.id &&
                    e.settings.isPublic &&
                    +new Date(e.endTime) >= now,
                ).length
              }{" "}
              upcoming events
            </small>
            <div className="row">
              <Follow c={c} />
              <Link className="btn" to={"/clubs/" + c.id}>
                View club
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!clubs.length && <p>No matching clubs.</p>}
    </div>
  );
}
export function Club() {
  const { s, u, now, change, toast } = useApp();
  const { id } = useParams();
  const c = s.clubs.find((x) => x.id === id || x.slug === id);
  const [invite, setInviteOpen] = useState(false),
    [target, setTarget] = useState("");
  if (!c) return <NotFound />;
  const host = c.adminUserIds.includes(u.id) || s.activeRole === "organizer";
  const ev = s.events
      .filter((e) => e.clubId === c.id && (e.settings.isPublic || host))
      .sort(timeOrder),
    up = ev.filter((e) => +new Date(e.endTime) >= now),
    past = ev.filter((e) => !up.includes(e));
  return (
    <div className="wrap band stack">
      <Link to="/clubs">← Clubs</Link>
      <img className="club-logo" src={c.logoUrl} alt="" />
      <span className="eyebrow">
        {c.category} / {c.memberCount} members
      </span>
      <h1>{c.name}</h1>
      <p>{c.description}</p>
      <p>
        Organizers ·{" "}
        {s.users
          .filter((v) => c.adminUserIds.includes(v.id))
          .map((v) => v.name)
          .join(", ")}
      </p>
      <div className="row">
        <Follow c={c} />
        <button
          onClick={() =>
            navigator.clipboard.writeText(location.href).then(
              () => toast("Club link copied"),
              () => toast("Copy the address from your browser"),
            )
          }
        >
          Copy link
        </button>
        {host && up.length > 0 && (
          <button
            onClick={() => {
              setTarget(up[0].id);
              setInviteOpen(true);
            }}
          >
            Re-invite past attendees
          </button>
        )}
      </div>
      {[up, past].map((list, i) => (
        <section key={i} className="stack">
          <h2>{i ? "Past events" : "Upcoming events"}</h2>
          {list.length ? (
            <div className="grid">
              {list.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          ) : (
            <p>No events in this section.</p>
          )}
        </section>
      ))}
      {invite && (
        <Dialog
          title="Re-invite past attendees"
          onClose={() => setInviteOpen(false)}
        >
          <label>
            Upcoming event
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {up.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              const ids = new Set(
                s.rsvps
                  .filter(
                    (r) =>
                      past.some((e) => r.eventId === e.id) &&
                      r.status === "going" &&
                      r.userId !== u.id,
                  )
                  .map((r) => r.userId),
              );
              change((d) =>
                ids.forEach((userId) =>
                  d.notifications.push({
                    id: crypto.randomUUID(),
                    userId,
                    eventId: target,
                    title: "An invitation from " + c.name,
                    message: up.find((e) => e.id === target)!.title,
                    read: false,
                    createdAt: new Date().toISOString(),
                  }),
                ),
              );
              toast("Invited " + ids.size + " past attendees");
              setInviteOpen(false);
            }}
          >
            Confirm invites
          </button>
        </Dialog>
      )}
    </div>
  );
}
export function NotFound() {
  return (
    <div className="wrap band stack">
      <h1>404</h1>
      <p>This campus page could not be found.</p>
      <Link className="btn" to="/">
        Back to Discover
      </Link>
    </div>
  );
}
