import { useEffect, useRef, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "./store";
import type { CampusEvent, Club, EventCategory, User, VibeTag } from "./models";
import { poster } from "./media";
import {
  downloadIcs,
  googleCalendar,
  downloadCsv,
  passCode,
  passImage,
  resizeImage,
  updateRsvp,
} from "./hubTools";
import "./manage.css";

const categories: EventCategory[] = [
  "Tech",
  "Cultural",
  "Sports",
  "Workshop",
  "Recruitment",
  "Social",
];
const vibes: VibeTag[] = [
  "Chill",
  "Learn Something",
  "Get Active",
  "Meet People",
  "Late Night",
];
const uid = () => crypto.randomUUID();
const fmt = (d: string | Date, opts: Intl.DateTimeFormatOptions) =>
  new Date(d).toLocaleString("en-IN", opts);
const clock = (d: string) => fmt(d, { hour: "numeric", minute: "2-digit" });
const shortDay = (d: string | Date) =>
  fmt(d, { month: "short", day: "numeric" });
const dayKey = (date: Date) => date.toDateString();
function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <label className="mg-field">
      <span>{name}</span>
      {children}
    </label>
  );
}
function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div data-component="manage-heading">
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="mg-dialog"
    >
      <div className="mg-row">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close dialog">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function switchItem<T>(list: T[], t: T) {
  return list.includes(t) ? list.filter((a) => a !== t) : [...list, t];
}
function EventList({ events }: { events: CampusEvent[] }) {
  return events.length ? (
    <ul className="mg-items">
      {events.map((e) => (
        <li key={e.id}>
          <Link to={"/events/" + e.id}>
            <img alt="" loading="lazy" src={poster(e)} />
            <span>
              <strong>{e.title}</strong>
              <small>
                {shortDay(e.startTime)} · {e.venue.name}
              </small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <p>
      No events here yet. <Link to="/">Discover events</Link>
    </p>
  );
}

export function CalendarPage() {
  const { s, u, change, toast } = useApp();
  const [view, setView] = useState("Week"),
    [anchor, setAnchor] = useState(() => new Date()),
    [day, setDay] = useState<Date | null>(null);
  const records = s.rsvps.filter(
    (r) => r.userId === u.id && (r.status === "going" || r.status === "maybe"),
  );
  const attending = s.events
    .filter((e) => !e.isPollMode && records.some((r) => r.eventId === e.id))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const going = attending.filter((e) =>
    records.some((r) => r.eventId === e.id && r.status === "going"),
  );
  const pairs = going.flatMap((a, i) =>
    going
      .slice(i + 1)
      .filter((b) => a.startTime < b.endTime && b.startTime < a.endTime)
      .map((b) => [a, b]),
  );
  const base = new Date(anchor);
  base.setHours(0, 0, 0, 0);
  if (view === "Month") base.setDate(1);
  const first = addDays(base, -((base.getDay() + 6) % 7));
  const days = Array.from({ length: view === "Week" ? 7 : 42 }, (_, i) =>
    addDays(first, i),
  );
  function shift(n: number) {
    if (view === "Week") setAnchor(addDays(anchor, 7 * n));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));
  }
  const onDay = (d: Date) =>
    attending.filter(
      (e) => new Date(e.startTime) < addDays(d, 1) && new Date(e.endTime) > d,
    );
  function chips(e: CampusEvent) {
    const clash = pairs.some((pair) => pair.includes(e));
    const maybe = records.some(
      (r) => r.eventId === e.id && r.status === "maybe",
    );
    return (
      <Link
        className="mg-event-chip"
        data-state={clash ? "clash" : maybe ? "maybe" : "going"}
        key={e.id}
        to={"/events/" + e.id}
      >
        <small>
          {clock(e.startTime)}
          {clash ? " · Clash" : maybe ? " · Maybe" : ""}
        </small>
        <strong>{e.title}</strong>
      </Link>
    );
  }
  return (
    <section className="wrap mg-page" data-component="calendar">
      <Head title="My calendar" sub="Your campus plans, all in one place." />
      {pairs.length > 0 && (
        <section className="mg-clashes">
          <h2>Schedule clashes</h2>
          {pairs.map(([a, b]) => (
            <div className="mg-clash" key={a.id + b.id}>
              {[a, b].map((e) => (
                <div key={e.id}>
                  <Link to={"/events/" + e.id}>{e.title}</Link>
                  <small>
                    {shortDay(e.startTime)} · {clock(e.startTime)}
                  </small>
                  <button
                    onClick={() => {
                      change((d) => {
                        updateRsvp(d, e.id, u.id, "cant_go");
                      });
                      toast("RSVP dropped");
                    }}
                  >
                    Drop RSVP
                  </button>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
      <div className="mg-toolbar">
        <div className="mg-segment">
          {["Week", "Month"].map((t) => (
            <button
              key={t}
              aria-pressed={view === t}
              onClick={() => setView(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <strong>
          {view === "Month"
            ? fmt(anchor, { month: "long", year: "numeric" })
            : shortDay(first) + " – " + shortDay(days[6])}
        </strong>
        <div className="mg-row">
          <button aria-label={"Previous " + view} onClick={() => shift(-1)}>
            ‹
          </button>
          <button onClick={() => setAnchor(new Date())}>Today</button>
          <button aria-label={"Next " + view} onClick={() => shift(1)}>
            ›
          </button>
        </div>
      </div>
      <div className={"mg-calendar mg-" + view.toLowerCase()}>
        {days.map((d) => {
          const items = onDay(d),
            today = dayKey(d) === dayKey(new Date());
          return (
            <section
              className="mg-day"
              key={dayKey(d)}
              data-today={today}
              data-outside={
                view === "Month" && d.getMonth() !== anchor.getMonth()
              }
            >
              <button
                className="mg-day-label"
                aria-label={fmt(d, { dateStyle: "full" })}
                onClick={() => setDay(d)}
              >
                <small>{fmt(d, { weekday: "short" })}</small> {d.getDate()}
              </button>
              {items.slice(0, view === "Month" ? 2 : undefined).map(chips)}
              {view === "Month" && items.length > 2 && (
                <button onClick={() => setDay(d)}>
                  +{items.length - 2} more
                </button>
              )}
            </section>
          );
        })}
      </div>
      <section className="mg-band">
        <h2>In your schedule</h2>
        {attending
          .filter(
            (e) =>
              new Date(e.startTime) < addDays(days.at(-1)!, 1) &&
              new Date(e.endTime) > first,
          )
          .map((e) => (
            <div className="mg-item-row" key={e.id}>
              <Link to={"/events/" + e.id}>{e.title}</Link>
              <small>
                {shortDay(e.startTime)} · {clock(e.startTime)}
              </small>
              <button onClick={() => downloadIcs(e)}>Download .ics</button>
              <a href={googleCalendar(e)} target="_blank" rel="noreferrer">
                Google Calendar
              </a>
            </div>
          ))}
        {!days.some((d) => onDay(d).length) && (
          <p>
            You have no plans in this range. <Link to="/">Find an event</Link>
          </p>
        )}
      </section>
      {day && (
        <Dialog
          title={fmt(day, { weekday: "long", day: "numeric", month: "long" })}
          onClose={() => setDay(null)}
        >
          <EventList events={onDay(day)} />
        </Dialog>
      )}
    </section>
  );
}

function ProfileForm({
  user,
  onSave,
}: {
  user: User;
  onSave: (user: Partial<User>) => void;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave({
      name: String(f.get("name")).trim(),
      usn: String(f.get("usn")).trim(),
      email: String(f.get("email")),
      bio: String(f.get("bio")),
      socials: {
        instagram: String(f.get("instagram")),
        linkedin: String(f.get("linkedin")),
        github: String(f.get("github")),
      },
    });
  }
  return (
    <form onSubmit={submit} className="mg-form">
      <Field name="Name">
        <input required pattern=".*\S.*" name="name" defaultValue={user.name} />
      </Field>
      <Field name="USN">
        <input required name="usn" defaultValue={user.usn} />
      </Field>
      <Field name="Email">
        <input type="email" required name="email" defaultValue={user.email} />
      </Field>
      <Field name="Bio">
        <textarea name="bio" defaultValue={user.bio} />
      </Field>
      {(["instagram", "linkedin", "github"] as const).map((k) => (
        <Field key={k} name={k}>
          <input name={k} defaultValue={user.socials[k]} />
        </Field>
      ))}
      <button className="mg-primary">Save profile</button>
    </form>
  );
}
export function ProfilePage() {
  const { u, s, change, toast, now } = useApp(),
    [editing, setEditing] = useState(false);
  const going = s.rsvps.filter(
    (r) => r.userId === u.id && r.status === "going",
  );
  const attended = s.events.filter(
    (e) => Date.parse(e.endTime) < now && going.some((r) => r.eventId === e.id),
  );
  const hosted = s.events.filter(
    (e) => e.hostUserId === u.id || e.coHostUserIds.includes(u.id),
  );
  const mutuals = s.users
    .filter((a) => a.id !== u.id)
    .map((a) => ({
      a,
      count: s.rsvps.filter(
        (r) =>
          r.userId === a.id &&
          r.status === "going" &&
          going.some((j) => j.eventId === r.eventId),
      ).length,
    }))
    .filter((m) => m.count)
    .sort((a, b) => b.count - a.count);
  function save(patch: Partial<User>) {
    change((d) =>
      Object.assign(
        d.users.find((a) => a.id === u.id)!,
        patch,
      ),
    );
  }
  return (
    <section className="wrap mg-page" data-component="profile">
      <div className="mg-profile-head">
        <img alt="" src={u.avatarUrl} />
        <div>
          <h1>{u.name}</h1>
          <p>{u.bio}</p>
          <small>
            {u.usn} · {u.email}
          </small>
        </div>
      </div>
      <div className="mg-row">
        <button onClick={() => setEditing(true)}>Edit profile</button>
        {s.activeRole === "organizer" && (
          <Link className="mg-action" to="/organizer">
            Organizer studio
          </Link>
        )}
      </div>
      <div className="mg-stats">
        {[
          [attended.length, "Events attended"],
          [hosted.length, "Events hosted"],
          [u.followedClubIds.length, "Clubs followed"],
          [mutuals.length, "Mutuals"],
        ].map(([n, label]) => (
          <div key={label}>
            <strong>{n}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <section className="mg-band">
        <h2>My interests</h2>
        <p>Choose what appears in your For You feed.</p>
        <div className="mg-row">
          {categories.map((c) => (
            <button
              key={c}
              data-component="chip" aria-pressed={u.interests.includes(c)}
              onClick={() => save({ interests: switchItem(u.interests, c) })}
            >
              {c}
            </button>
          ))}
        </div>
      </section>
      <section className="mg-band">
        <h2>My entry passes</h2>
        {going
          .filter((r) =>
            s.events.some(
              (e) => e.id === r.eventId && Date.parse(e.endTime) >= now,
            ),
          )
          .map((r) => {
            const ev = s.events.find((e) => e.id === r.eventId)!;
            return (
              <details key={r.id}>
                <summary>{ev.title}</summary>
                <div className="mg-pass">
                  <img
                    width="128"
                    height="128"
                    src={passImage(passCode(r))}
                    alt="Demo entry pass"
                  />
                  <div>
                    <strong>{u.name}</strong>
                    <p>
                      {ev.venue.name} · {clock(ev.startTime)}
                    </p>
                    <code>{passCode(r)}</code>
                  </div>
                </div>
              </details>
            );
          })}
        {!going.some((r) =>
          s.events.some(
            (e) => e.id === r.eventId && Date.parse(e.endTime) >= now,
          ),
        ) && <p>RSVP Going to collect your first pass.</p>}
      </section>
      <section className="mg-band">
        <h2>Mutuals</h2>
        <div className="mg-mutuals">
          {mutuals.map(({ a, count }) => (
            <div key={a.id}>
              <img src={a.avatarUrl} alt="" />
              <span>
                <strong>{a.name}</strong>
                <small>
                  {count} shared {count === 1 ? "event" : "events"}
                </small>
              </span>
            </div>
          ))}
        </div>
        {!mutuals.length && (
          <p>People attending the same events as you will appear here.</p>
        )}
      </section>
      <section className="mg-band">
        <h2>Saved events</h2>
        <EventList
          events={s.events.filter((e) => u.savedEventIds.includes(e.id))}
        />
      </section>
      <section className="mg-band">
        <h2>Past events</h2>
        <EventList events={attended} />
      </section>
      {editing && (
        <Dialog title="Edit profile" onClose={() => setEditing(false)}>
          <ProfileForm
            key={u.id}
            user={u}
            onSave={(patch) => {
              save(patch);
              setEditing(false);
              toast("Profile saved");
            }}
          />
        </Dialog>
      )}
    </section>
  );
}

const localTime = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : "");
function blankEvent(
  club: Club,
  user: User,
  venue: CampusEvent["venue"],
): CampusEvent {
  const start = Date.now() + 86400000;
  return {
    id: uid(),
    title: "",
    description: "",
    clubId: club.id,
    hostUserId: user.id,
    coHostUserIds: [],
    category: club.category,
    vibes: [],
    posterUrl: "",
    startTime: new Date(start).toISOString(),
    endTime: new Date(start + 3600000).toISOString(),
    venue: { ...venue },
    isFree: true,
    isPollMode: false,
    datePollOptions: [],
    ticketTiers: [],
    promoCodes: [],
    chipIn: { enabled: false, mode: "required" },
    questionnaire: [],
    settings: {
      isPublic: true,
      rsvpsOpen: true,
      requireApproval: false,
      maxPlusOnes: 0,
      allowGuestsInviteMutuals: true,
      anonymizeGuestList: false,
      hideGuestCount: false,
      hideActivityTimestamps: false,
      allowPhotoUploads: true,
      autoRemindersEnabled: true,
      allowBlastReplies: true,
    },
    createdAt: new Date().toISOString(),
  };
}
function EventEditor({
  initial,
  clubs,
  onSave,
  onCancel,
}: {
  initial: CampusEvent;
  clubs: Club[];
  onSave: (e: CampusEvent) => void;
  onCancel: () => void;
}) {
  const { s } = useApp(),
    [e, setEvent] = useState(initial),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [customVenue, setCustomVenue] = useState(
    !s.events.some((a) => a.venue.name === initial.venue.name),
  );
  const venues = Array.from(
    new Map(s.events.map((a) => [a.venue.name, a.venue])).values(),
  );
  const price = e.chipIn.enabled ? "Chip-In" : e.isFree ? "Free" : "Ticketed";
  function patch(p: Partial<CampusEvent>) {
    setEvent((x) => ({ ...x, ...p }));
    setError("");
  }
  function setting(p: Partial<CampusEvent["settings"]>) {
    patch({ settings: { ...e.settings, ...p } });
  }
  const preview = { ...e, title: e.title || "Your campus event" };
  function pollSlot(
    index: number,
    patchSlot: Partial<CampusEvent["datePollOptions"][number]>,
  ) {
    patch({
      datePollOptions: e.datePollOptions.map((x, i) =>
        i === index ? { ...x, ...patchSlot } : x,
      ),
    });
  }
  function addSlot() {
    const offset = e.datePollOptions.length * 86400000;
    patch({
      datePollOptions: [
        ...e.datePollOptions,
        {
          id: uid(),
          startTime: new Date(
            (Date.parse(e.startTime) || Date.now()) + offset,
          ).toISOString(),
          endTime: new Date(
            (Date.parse(e.endTime) || Date.now() + 3600000) + offset,
          ).toISOString(),
          voterUserIds: [],
        },
      ],
    });
  }
  function ticket(
    index: number,
    p: Partial<CampusEvent["ticketTiers"][number]>,
  ) {
    patch({
      ticketTiers: e.ticketTiers.map((a, i) =>
        i === index ? { ...a, ...p } : a,
      ),
    });
  }
  function question(
    index: number,
    p: Partial<CampusEvent["questionnaire"][number]>,
  ) {
    patch({
      questionnaire: e.questionnaire.map((a, i) =>
        i === index ? { ...a, ...p } : a,
      ),
    });
  }
  function submit(ev: FormEvent) {
    ev.preventDefault();
    const dates = e.isPollMode ? e.datePollOptions : [e];
    const duplicate = (items: string[]) =>
      new Set(items.map((a) => a.toLowerCase().trim())).size !== items.length;
    let issue = "";
    if (!e.title.trim()) issue = "Give your event a title.";
    else if (e.isPollMode && dates.length < 2)
      issue = "Add at least two date options for a poll.";
    else if (
      dates.some(
        (a) =>
          !a.startTime ||
          !a.endTime ||
          Date.parse(a.startTime) >= Date.parse(a.endTime),
      )
    )
      issue = "Each event must end after it starts.";
    else if (
      price === "Ticketed" &&
      (!e.ticketTiers.length ||
        e.ticketTiers.some((t) => !t.name.trim() || t.capacity < t.soldCount))
    )
      issue = "Add a named ticket tier with enough capacity for sold tickets.";
    else if (duplicate(e.promoCodes.map((p) => p.code)))
      issue = "Give each promotion a unique code.";
    else if (
      e.questionnaire.some(
        (q) =>
          !q.label.trim() ||
          (q.type === "dropdown" && !q.options?.some((x) => x.trim())),
      )
    )
      issue = "Add a label and options to each question.";
    else if (!e.venue.name.trim()) issue = "Enter a venue name.";
    if (issue) {
      setError(issue);
      return;
    }
    onSave({
      ...e,
      title: e.title.trim(),
      description:
        e.description.trim() ||
        "Join " +
          (clubs.find((c) => c.id === e.clubId)?.name || "the club") +
          " at " +
          e.venue.name +
          ".",
      startTime: dates[0].startTime,
      endTime: dates[0].endTime,
      ticketTiers: price === "Ticketed" ? e.ticketTiers : [],
      promoCodes:
        price === "Ticketed"
          ? e.promoCodes.map((p) => ({
              ...p,
              code: p.code.trim().toUpperCase(),
            }))
          : [],
      isSeed: false,
    });
  }
  return (
    <div className="mg-editor">
      <form
        className="mg-form"
        onSubmit={submit}
        onBlur={(ev) => {
          const field = ev.target;
          if (field instanceof HTMLInputElement && !field.validity.valid) {
            const label = field.labels?.[0]?.querySelector("span")?.textContent;
            field.setAttribute("aria-invalid", "true");
            field.setAttribute("aria-describedby", "event-form-error");
            setError(
              [label, field.validationMessage].filter(Boolean).join(" — "),
            );
          }
        }}
        onInput={(ev) => {
          const field = ev.target;
          if (field instanceof HTMLInputElement && field.validity.valid) {
            field.removeAttribute("aria-invalid");
            field.removeAttribute("aria-describedby");
          }
        }}
        onInvalidCapture={(ev) => {
          const field = ev.target as HTMLInputElement;
          let parent: HTMLElement | null = field.parentElement;
          while (parent) {
            if (parent.tagName === "DETAILS")
              (parent as HTMLDetailsElement).open = true;
            parent = parent.parentElement;
          }
          setError(field.validationMessage);
        }}
      >
        <fieldset>
          <legend>Basics</legend>
          <Field name="Event title">
            <input
              required
              maxLength={140}
              placeholder="e.g. RIT Design Jam"
              value={e.title}
              onChange={(ev) => patch({ title: ev.target.value })}
            />
          </Field>
          <div className="mg-two">
            <Field name="Club">
              <select
                value={e.clubId}
                onChange={(ev) => patch({ clubId: ev.target.value })}
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="Category">
              <select
                value={e.category}
                onChange={(ev) =>
                  patch({ category: ev.target.value as EventCategory })
                }
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field name="Description">
            <textarea
              rows={3}
              value={e.description}
              onChange={(ev) => patch({ description: ev.target.value })}
            />
          </Field>
          <div className="mg-field">
            <span>Vibe</span>
            <div className="mg-row">
              {vibes.map((v) => (
                <button
                  type="button"
                  key={v}
                  data-component="chip" aria-pressed={e.vibes.includes(v)}
                  onClick={() => patch({ vibes: switchItem(e.vibes, v) })}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <Field name="Poster preset">
            <select
              defaultValue=""
              onChange={(ev) =>
                patch({
                  posterUrl: ev.target.value
                    ? poster(s.events.find((a) => a.id === ev.target.value)!)
                    : "",
                })
              }
            >
              <option value="">Generated for this event</option>
              {s.events
                .filter((a) => a.isSeed)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field name="Upload a poster">
            <input
              type="file"
              accept="image/*"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                setLoading(true);
                try {
                  patch({ posterUrl: await resizeImage(file) });
                } catch {
                  setError("Choose a readable image file.");
                } finally {
                  setLoading(false);
                }
              }}
            />
          </Field>
        </fieldset>
        <details open>
          <summary>Schedule and venue</summary>
          <div className="mg-block">
            <Field name="Schedule">
              <select
                value={e.isPollMode ? "poll" : "fixed"}
                onChange={(ev) =>
                  patch({ isPollMode: ev.target.value === "poll" })
                }
              >
                <option value="fixed">Fixed date</option>
                <option value="poll">Date poll</option>
              </select>
            </Field>
            {!e.isPollMode ? (
              <div className="mg-two">
                {(["startTime", "endTime"] as const).map((k, i) => (
                  <Field key={k} name={i ? "End time" : "Start time"}>
                    <input
                      type="datetime-local"
                      required
                      value={localTime(e[k])}
                      onChange={(ev) =>
                        patch({ [k]: fromLocal(ev.target.value) })
                      }
                    />
                  </Field>
                ))}
              </div>
            ) : (
              <>
                {e.datePollOptions.map((opt, i) => (
                  <div className="mg-block mg-inset" key={opt.id}>
                    <strong>Option {i + 1}</strong>
                    <div className="mg-two">
                      {(["startTime", "endTime"] as const).map((k, j) => (
                        <Field key={k} name={j ? "Ends" : "Starts"}>
                          <input
                            type="datetime-local"
                            required
                            value={localTime(opt[k])}
                            onChange={(ev) =>
                              pollSlot(i, { [k]: fromLocal(ev.target.value) })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          datePollOptions: e.datePollOptions.filter(
                            (a) => a.id !== opt.id,
                          ),
                        })
                      }
                    >
                      Remove option
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addSlot}>
                  Add date option
                </button>
              </>
            )}
            <Field name="Venue">
              <select
                value={customVenue ? "custom" : e.venue.name}
                onChange={(ev) => {
                  const v = venues.find((a) => a.name === ev.target.value);
                  setCustomVenue(!v);
                  patch({
                    venue: v || {
                      building: "",
                      name: "",
                      distanceMinutesFromCenter: 0,
                    },
                  });
                }}
              >
                {venues.map((v) => (
                  <option key={v.name}>{v.name}</option>
                ))}
                <option value="custom">Custom venue</option>
              </select>
            </Field>
            {customVenue && (
              <>
                <Field name="Venue name">
                  <input
                    required
                    value={e.venue.name}
                    onChange={(ev) =>
                      patch({ venue: { ...e.venue, name: ev.target.value } })
                    }
                  />
                </Field>
                <div className="mg-two">
                  <Field name="Building">
                    <input
                      value={e.venue.building}
                      onChange={(ev) =>
                        patch({
                          venue: { ...e.venue, building: ev.target.value },
                        })
                      }
                    />
                  </Field>
                  <Field name="Walk from campus centre (min)">
                    <input
                      type="number"
                      min="0"
                      value={e.venue.distanceMinutesFromCenter}
                      onChange={(ev) =>
                        patch({
                          venue: {
                            ...e.venue,
                            distanceMinutesFromCenter: +ev.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              </>
            )}
          </div>
        </details>
        <details>
          <summary>Guest access</summary>
          <div className="mg-block">
            <div className="mg-two">
              <Field name="Guest capacity">
                <input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={e.settings.capacity ?? ""}
                  onChange={(ev) =>
                    setting({
                      capacity: ev.target.value ? +ev.target.value : undefined,
                    })
                  }
                />
              </Field>
              <Field name="Plus ones per guest">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={e.settings.maxPlusOnes}
                  onChange={(ev) => setting({ maxPlusOnes: +ev.target.value })}
                />
              </Field>
            </div>
            {(
              [
                ["rsvpsOpen", "Open RSVPs"],
                ["isPublic", "Public event"],
                ["requireApproval", "Require host approval"],
                ["allowGuestsInviteMutuals", "Allow guest invitations"],
                ["anonymizeGuestList", "Anonymize guests"],
                ["hideGuestCount", "Hide guest count"],
                ["hideActivityTimestamps", "Hide activity timestamps"],
                ["allowPhotoUploads", "Allow photo uploads"],
                ["autoRemindersEnabled", "Enable reminders"],
                ["allowBlastReplies", "Allow replies to host blasts"],
              ] as const
            ).map(([k, label]) => (
              <label className="mg-check" key={k}>
                <input
                  type="checkbox"
                  checked={e.settings[k]}
                  onChange={(ev) => setting({ [k]: ev.target.checked })}
                />
                {label}
              </label>
            ))}
            <Field name="Event password">
              <input
                autoComplete="off"
                value={e.settings.password || ""}
                onChange={(ev) => setting({ password: ev.target.value })}
              />
            </Field>
            <strong>Co-hosts</strong>
            {s.users
              .filter((a) => a.id !== e.hostUserId)
              .map((a) => (
                <label key={a.id} className="mg-check">
                  <input
                    type="checkbox"
                    checked={e.coHostUserIds.includes(a.id)}
                    onChange={() =>
                      patch({
                        coHostUserIds: switchItem(e.coHostUserIds, a.id),
                      })
                    }
                  />
                  {a.name}
                </label>
              ))}
          </div>
        </details>
        <details>
          <summary>Tickets and contributions</summary>
          <div className="mg-block">
            <Field name="Pricing">
              <select
                value={price}
                onChange={(ev) =>
                  patch({
                    isFree: ev.target.value === "Free",
                    chipIn: {
                      ...e.chipIn,
                      enabled: ev.target.value === "Chip-In",
                    },
                  })
                }
              >
                {["Free", "Ticketed", "Chip-In"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            {price === "Ticketed" && (
              <>
                {e.ticketTiers.map((t, i) => (
                  <div className="mg-inset mg-block" key={t.id}>
                    <Field name="Ticket tier">
                      <input
                        required
                        value={t.name}
                        onChange={(ev) => ticket(i, { name: ev.target.value })}
                      />
                    </Field>
                    <div className="mg-two">
                      <Field name="Price (INR)">
                        <input
                          required
                          type="number"
                          min="0"
                          value={t.priceInr}
                          onChange={(ev) =>
                            ticket(i, { priceInr: +ev.target.value })
                          }
                        />
                      </Field>
                      <Field name="Tickets available">
                        <input
                          required
                          type="number"
                          min={Math.max(1, t.soldCount)}
                          value={t.capacity}
                          onChange={(ev) =>
                            ticket(i, { capacity: +ev.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <button
                      type="button"
                      disabled={t.soldCount > 0}
                      onClick={() =>
                        patch({
                          ticketTiers: e.ticketTiers.filter(
                            (a) => a.id !== t.id,
                          ),
                        })
                      }
                    >
                      Remove tier
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      ticketTiers: [
                        ...e.ticketTiers,
                        {
                          id: uid(),
                          name: "General",
                          priceInr: 100,
                          capacity: 50,
                          soldCount: 0,
                        },
                      ],
                    })
                  }
                >
                  Add ticket tier
                </button>
                {e.promoCodes.map((p, i) => (
                  <div className="mg-inset mg-block" key={i}>
                    <div className="mg-two">
                      <Field name="Promo code">
                        <input
                          required
                          value={p.code}
                          onChange={(ev) =>
                            patch({
                              promoCodes: e.promoCodes.map((a, j) =>
                                j === i
                                  ? {
                                      ...a,
                                      code: ev.target.value.toUpperCase(),
                                    }
                                  : a,
                              ),
                            })
                          }
                        />
                      </Field>
                      <Field name="Discount (%)">
                        <input
                          required
                          type="number"
                          min="1"
                          max="100"
                          value={p.discountPercent}
                          onChange={(ev) =>
                            patch({
                              promoCodes: e.promoCodes.map((a, j) =>
                                j === i
                                  ? { ...a, discountPercent: +ev.target.value }
                                  : a,
                              ),
                            })
                          }
                        />
                      </Field>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          promoCodes: e.promoCodes.filter((_, j) => j !== i),
                        })
                      }
                    >
                      Remove code
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      promoCodes: [
                        ...e.promoCodes,
                        { code: "", discountPercent: 10 },
                      ],
                    })
                  }
                >
                  Add promo code
                </button>
              </>
            )}
            {price === "Chip-In" && (
              <>
                <Field name="Contribution type">
                  <select
                    value={e.chipIn.mode}
                    onChange={(ev) =>
                      patch({
                        chipIn: {
                          ...e.chipIn,
                          mode: ev.target.value as
                            "required" | "pay_what_you_can",
                        },
                      })
                    }
                  >
                    <option value="required">Required contribution</option>
                    <option value="pay_what_you_can">Pay what you can</option>
                  </select>
                </Field>
                <Field name="Amount (INR)">
                  <input
                    type="number"
                    min="1"
                    required={e.chipIn.mode === "required"}
                    value={e.chipIn.amountInr ?? ""}
                    onChange={(ev) =>
                      patch({
                        chipIn: {
                          ...e.chipIn,
                          amountInr: ev.target.value
                            ? +ev.target.value
                            : undefined,
                        },
                      })
                    }
                  />
                </Field>
                <Field name="UPI ID">
                  <input
                    required
                    value={e.chipIn.upiId || ""}
                    onChange={(ev) =>
                      patch({ chipIn: { ...e.chipIn, upiId: ev.target.value } })
                    }
                  />
                </Field>
                <Field name="Payment link">
                  <input
                    type="url"
                    pattern="https?://.*"
                    value={e.chipIn.paymentLink || ""}
                    onChange={(ev) =>
                      patch({
                        chipIn: { ...e.chipIn, paymentLink: ev.target.value },
                      })
                    }
                  />
                </Field>
              </>
            )}
          </div>
        </details>
        <details>
          <summary>RSVP questionnaire</summary>
          <div className="mg-block">
            {e.questionnaire.map((q, i) => (
              <div key={q.id} className="mg-block mg-inset">
                <Field name="Question">
                  <input
                    required
                    value={q.label}
                    onChange={(ev) => question(i, { label: ev.target.value })}
                  />
                </Field>
                <Field name="Answer type">
                  <select
                    value={q.type}
                    onChange={(ev) =>
                      question(i, {
                        type: ev.target.value as "short_text" | "dropdown",
                      })
                    }
                  >
                    <option value="short_text">Short text</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                </Field>
                {q.type === "dropdown" && (
                  <Field name="Choices, one per line">
                    <textarea
                      required
                      value={q.options?.join("\n") || ""}
                      onChange={(ev) =>
                        question(i, { options: ev.target.value.split("\n") })
                      }
                    />
                  </Field>
                )}
                <label className="mg-check">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(ev) =>
                      question(i, { required: ev.target.checked })
                    }
                  />
                  Required answer
                </label>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      questionnaire: e.questionnaire.filter(
                        (a) => a.id !== q.id,
                      ),
                    })
                  }
                >
                  Remove question
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch({
                  questionnaire: [
                    ...e.questionnaire,
                    {
                      id: uid(),
                      label: "",
                      type: "short_text",
                      required: true,
                    },
                  ],
                })
              }
            >
              Add question
            </button>
          </div>
        </details>
        <div className="mg-save">
          {error && (
            <p role="alert" id="event-form-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="mg-primary">
            Save event
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
      <aside className="mg-preview">
        <h2>Event preview</h2>
        <img alt="Event poster preview" src={poster(preview)} />
        <small>
          {e.category} · {clubs.find((c) => c.id === e.clubId)?.name}
        </small>
        <h3>{preview.title}</h3>
        <p>
          {e.isPollMode
            ? "Date poll"
            : e.startTime
              ? shortDay(e.startTime) + " · " + clock(e.startTime)
              : "Date to be set"}
        </p>
        <p>{e.venue.name}</p>
      </aside>
    </div>
  );
}

function ClubEditor({
  club,
  onSave,
}: {
  club: Club;
  onSave: (p: Partial<Club>) => void;
}) {
  return (
    <form
      className="mg-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        onSave({
          name: String(f.get("name")).trim(),
          description: String(f.get("description")).trim(),
          category: f.get("category") as EventCategory,
          instagramHandle: String(f.get("instagram")).trim(),
        });
      }}
    >
      <Field name="Club name">
        <input required name="name" defaultValue={club.name} />
      </Field>
      <Field name="Description">
        <textarea name="description" required defaultValue={club.description} />
      </Field>
      <Field name="Category">
        <select name="category" defaultValue={club.category}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field name="Instagram handle">
        <input name="instagram" defaultValue={club.instagramHandle} />
      </Field>
      <button className="mg-primary">Save club profile</button>
    </form>
  );
}
export function OrganizerPage() {
  const { s, u, change, toast } = useApp(),
    [params, setParams] = useSearchParams();
  const id = params.get("edit"),
    tab = id
      ? "Create/Edit Event"
      : params.get("tab") === "managed"
        ? "My Managed Events"
        : params.get("tab") === "club"
          ? "Club Profile Editor"
          : "Create/Edit Event";
  const clubs = s.clubs.filter(
    (c) =>
      s.activeRole === "organizer" ||
      u.managedClubIds.includes(c.id) ||
      c.adminUserIds.includes(u.id),
  );
  const [clubId, setClubId] = useState(""),
    [resetKey, setResetKey] = useState(0);
  const selected = clubs.find((c) => c.id === clubId) || clubs[0];
  const managed = s.events.filter(
    (e) =>
      e.hostUserId === u.id ||
      e.coHostUserIds.includes(u.id) ||
      clubs.some((c) => c.id === e.clubId),
  );
  const editing = managed.find((a) => a.id === id);
  function tabs(t: string) {
    setParams(
      t === "Create/Edit Event"
        ? {}
        : { tab: t === "Club Profile Editor" ? "club" : "managed" },
    );
  }
  function save(e: CampusEvent) {
    change((d) => {
      const n = d.events.findIndex((a) => a.id === e.id);
      if (n < 0) d.events.unshift(e);
      else d.events[n] = e;
    });
    toast(editing ? "Event updated" : "Event created");
    setParams({ tab: "managed" });
  }
  return (
    <section className="wrap mg-page" data-component="organizer">
      <Head
        title="Organizer studio"
        sub="Create campus events, manage your guests and keep your club up to date."
      />
      {s.activeRole !== "organizer" ? (
        <div className="mg-band">
          <h2>Organizer access</h2>
          <p>Switch your demo role to manage campus events.</p>
          <button
            className="mg-primary"
            onClick={() =>
              change((d) => {
                d.activeRole = "organizer";
              })
            }
          >
            Switch to organizer
          </button>
        </div>
      ) : (
        <>
          <div className="mg-tabs">
            {[
              "Create/Edit Event",
              "My Managed Events",
              "Club Profile Editor",
            ].map((t) => (
              <button key={t} aria-pressed={t === tab} onClick={() => tabs(t)}>
                {t}
              </button>
            ))}
          </div>
          {tab === "Create/Edit Event" &&
            selected &&
            (id && !editing ? (
              <p>
                This event is unavailable.{" "}
                <Link to="/organizer">Create an event</Link>
              </p>
            ) : (
              <EventEditor
                key={[u.id, id || "new", resetKey].join("-")}
                initial={
                  editing ||
                  blankEvent(
                    selected,
                    u,
                    s.events[0]?.venue || {
                      name: "RIT Main Ground",
                      building: "Main campus",
                      distanceMinutesFromCenter: 3,
                    },
                  )
                }
                clubs={clubs}
                onSave={save}
                onCancel={() => {
                  setResetKey((x) => x + 1);
                  tabs("My Managed Events");
                }}
              />
            ))}
          {tab === "My Managed Events" && (
            <>
              <div className="mg-row">
                <h2>Managed events</h2>
                <button
                  className="mg-primary"
                  onClick={() => tabs("Create/Edit Event")}
                >
                  Create event
                </button>
              </div>
              <div className="mg-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {["Event", "Going", "Waitlist", "Pending", "Actions"].map(
                        (v) => (
                          <th key={v}>{v}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {managed.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <Link to={"/events/" + e.id}>{e.title}</Link>
                          <small>
                            {shortDay(e.startTime)} · {e.venue.name}
                          </small>
                        </td>
                        {["going", "waitlist", "pending"].map((st) => (
                          <td key={st} data-label={st}>
                            {
                              s.rsvps.filter(
                                (r) => r.eventId === e.id && r.status === st,
                              ).length
                            }
                          </td>
                        ))}
                        <td>
                          <div className="mg-row">
                            <button onClick={() => setParams({ edit: e.id })}>
                              Edit
                            </button>
                            <Link to={"/events/" + e.id + "#host"}>
                              Manage guests / blast
                            </Link>
                            <button onClick={() => downloadCsv(e, s)}>
                              Export CSV
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "Club Profile Editor" && selected && (
            <div className="mg-club-edit">
              <Field name="Club to edit">
                <select
                  value={selected.id}
                  onChange={(ev) => setClubId(ev.target.value)}
                >
                  {clubs.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <ClubEditor
                key={selected.id}
                club={selected}
                onSave={(p) => {
                  change((d) =>
                    Object.assign(
                      d.clubs.find((c) => c.id === selected.id)!,
                      p,
                    ),
                  );
                  toast("Club profile saved");
                }}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
