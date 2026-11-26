import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "./store";
import { poster } from "./media";
import type { CampusEvent, RsvpStatus } from "./models";
import {
  when,
  updateRsvp,
  downloadIcs,
  googleCalendar,
  labels,
} from "./hubTools";
import {
  EntryPass,
  Poll,
  Modal,
  SharePoster,
  RsvpForm,
  copy,
} from "./hubForms";
import { Host } from "./hubHost";
import { Album, Wall, Invites, boop } from "./hubSocial";
import "./hub.css";

export default function Hub() {
  const { id } = useParams(),
    { s, u } = useApp(),
    e = s.events.find((x) => x.id === id);
  if (!e)
    return (
      <article className="hub">
        <section>
          <h1>Event not found</h1>
          <Link to="/">Back to Discover</Link>
        </section>
      </article>
    );
  return <EventPage key={e.id + u.id} e={e} />;
}
function EventPage({ e }: { e: CampusEvent }) {
  const { s, u, now, change, toast } = useApp(),
    [modal, setModal] = useState(() =>
      new URLSearchParams(location.search).get("rsvp") === "going" &&
      e.settings.rsvpsOpen &&
      !e.isPollMode &&
      Date.parse(e.endTime) >= now
        ? "rsvp"
        : "",
    ),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [guestTab, setGuestTab] = useState<RsvpStatus>("going");
  const club = s.clubs.find((v) => v.id === e.clubId)!,
    host =
      s.activeRole === "organizer" ||
      e.hostUserId === u.id ||
      e.coHostUserIds.includes(u.id);
  const guests = s.rsvps.filter((r) => r.eventId === e.id),
    mine = guests.find((r) => r.userId === u.id),
    following = u.followedClubIds.includes(club.id),
    saved = u.savedEventIds.includes(e.id);
  const start = Date.parse(e.startTime),
    end = Date.parse(e.endTime),
    past = end < now && !e.isPollMode,
    live = !e.isPollMode && start <= now && end >= now,
    mins = Math.ceil((start - now) / 60000);
  const status = e.isPollMode
    ? "Date poll open"
    : live
      ? "Happening now"
      : past
        ? "Ended"
        : mins <= 180
          ? "Starts in " + mins + " min"
          : "Upcoming";
  const gated =
    e.settings.password &&
    !host &&
    !s.unlockedEventIds.includes(u.id + ":" + e.id);
  if (gated)
    return (
      <div className="hub">
        <section className="hub-gate">
          <small>PRIVATE EVENT</small>
          <h1>Unlock event</h1>
          <p>Enter the password from your host to open this invite.</p>
          <form
            className="hub-form"
            onSubmit={(v) => {
              v.preventDefault();
              if (password !== e.settings.password) {
                setError("That password did not match. Try again.");
                return;
              }
              change((d) => {
                d.unlockedEventIds.push(u.id + ":" + e.id);
              });
              setError("");
            }}
          >
            <label>
              Event password
              <input
                required
                type="password"
                value={password}
                aria-invalid={!!error}
                onChange={(v) => setPassword(v.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="hub-primary">Unlock event</button>
          </form>
        </section>
      </div>
    );
  const guestsShown = guests
    .filter((r) => r.status === guestTab)
    .sort((a, b) => a.firstRsvpAt.localeCompare(b.firstRsvpAt));
  const who = [e.hostUserId, ...e.coHostUserIds]
    .map((id) => s.users.find((v) => v.id === id))
    .filter((v) => !!v);
  return (
    <article className="hub" data-component="event-hub">
      <header className="hub-breadcrumb">
        <Link to="/">Discover</Link>
        <span>/</span>
        <Link to={"/clubs/" + club.id}>{club.name}</Link>
        <span>/</span>
        <span>Event</span>
      </header>
      <section className="hub-hero">
        <div className="hub-art">
          <img src={poster(e)} alt={e.title + " poster"} />
        </div>
        <div className="hub-overview">
          <div className="hub-actions">
            <span className="hub-tag" data-state={live ? "live" : "scheduled"}>
              {status}
            </span>
            <span className="hub-tag">{e.category}</span>
          </div>
          <h1>{e.title}</h1>
          <div className="hub-club">
            <Link to={"/clubs/" + club.id}>{club.name}</Link>
            <button
              onClick={() => {
                change((d) => {
                  const user = d.users.find((v) => v.id === u.id)!;
                  user.followedClubIds = following
                    ? user.followedClubIds.filter((id) => id !== club.id)
                    : [...user.followedClubIds, club.id];
                  d.clubs.find((c) => c.id === club.id)!.memberCount +=
                    following ? -1 : 1;
                });
                toast(following ? "Club unfollowed" : "Following " + club.name);
              }}
              aria-pressed={following}
            >
              {following ? "Following" : "+ Follow"}
            </button>
          </div>
          <dl className="hub-facts">
            <div>
              <dt>When</dt>
              <dd>
                {e.isPollMode
                  ? "Guests are choosing a date"
                  : when(e.startTime) +
                    " – " +
                    new Date(e.endTime).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
              </dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>
                {e.venue.name}
                <small>
                  {e.venue.building} · {e.venue.distanceMinutesFromCenter} min
                  walk
                </small>
              </dd>
            </div>
            <div>
              <dt>Admission</dt>
              <dd>
                {e.chipIn.enabled
                  ? e.chipIn.mode === "required"
                    ? "₹" + e.chipIn.amountInr + " chip-in"
                    : "Pay what you can"
                  : e.ticketTiers.length
                    ? "From ₹" +
                      Math.min(...e.ticketTiers.map((t) => t.priceInr))
                    : "Free entry"}
              </dd>
            </div>
            <div>
              <dt>Hosted by</dt>
              <dd>
                <span className="avatar-line">
                  {who.map((v) => (
                    <img
                      key={v.id}
                      width="28"
                      height="28"
                      alt=""
                      src={v.avatarUrl}
                    />
                  ))}
                </span>
                {who.map((v) => v.name).join(", ")}
              </dd>
            </div>
          </dl>
          {e.isPollMode ? (
            <Poll e={e} host={host} />
          ) : (
            <>
              <h3>Your RSVP</h3>
              <div className="hub-actions">
                {(["going", "maybe", "cant_go"] as RsvpStatus[]).map((r) => (
                  <button
                    key={r}
                    className={r === "going" ? "hub-primary" : ""}
                    aria-pressed={mine?.status === r}
                    disabled={!e.settings.rsvpsOpen || past}
                    onClick={() => {
                      if (r === "going") setModal("rsvp");
                      else {
                        change((d) => updateRsvp(d, e.id, u.id, r));
                        toast("RSVP updated · " + labels[r]);
                      }
                    }}
                  >
                    {labels[r]}
                  </button>
                ))}
              </div>
              {(!e.settings.rsvpsOpen || past) && (
                <small>
                  {past ? "This event has ended." : "RSVPs are closed."}
                </small>
              )}
              {mine && <p role="status">Your status · <span className="badge" data-tone={mine.status === "going" ? "going" : "neutral"}>{mine.status === "going" && <span aria-hidden="true">✓ </span>}{labels[mine.status]}</span></p>}
            </>
          )}
          <div className="hub-actions hub-tools">
            <button
              aria-pressed={saved}
              onClick={() => {
                change((d) => {
                  const user = d.users.find((v) => v.id === u.id)!;
                  user.savedEventIds = saved
                    ? user.savedEventIds.filter((id) => id !== e.id)
                    : [...user.savedEventIds, e.id];
                });
                toast(saved ? "Removed from Saved" : "Event saved");
              }}
            >
              {saved ? "Saved" : "Save"}
            </button>
            <button onClick={() => copy(location.href, toast)}>
              Share link
            </button>
            <button onClick={() => setModal("poster")}>
              Share poster card
            </button>
            {!e.isPollMode && (
              <button onClick={() => setModal("calendar")}>
                Add to calendar
              </button>
            )}
          </div>
          {mine?.status === "going" && <EntryPass e={e} r={mine} />}
        </div>
      </section>
      <section>
        <h2>About the event</h2>
        <p className="hub-body">{e.description}</p>
        <div className="hub-actions">
          {e.vibes.map((v) => (
            <span key={v} className="hub-tag">
              {v}
            </span>
          ))}
        </div>
      </section>
      <section>
        <div className="hub-row">
          <h2>Guest list</h2>
          {(host || e.settings.allowGuestsInviteMutuals) && (
            <button onClick={() => setModal("invite")}>Invite mutuals</button>
          )}
        </div>
        <div className="hub-actions" aria-label="Guest status">
          {(
            [
              "going",
              "maybe",
              "waitlist",
              "cant_go",
              ...(host ? ["pending"] : []),
            ] as RsvpStatus[]
          ).map((t) => (
            <button
              key={t}
              aria-pressed={t === guestTab}
              onClick={() => setGuestTab(t)}
            >
              {labels[t]}
              {host || !e.settings.hideGuestCount
                ? " · " + guests.filter((r) => r.status === t).length
                : ""}
            </button>
          ))}
        </div>
        {guestsShown.length ? (
          guestsShown.map((r, i) => {
            const v = s.users.find((x) => x.id === r.userId)!,
              anon =
                e.settings.anonymizeGuestList && !host && r.userId !== u.id;
            return (
              <div key={r.id} className="hub-line">
                <div className="hub-person">
                  {anon ? <span className="hub-avatar" aria-hidden="true">•</span> : <img className="hub-avatar" src={v.avatarUrl} alt="" />}
                  <strong>
                    {guestTab === "waitlist" ? "#" + (i + 1) + " · " : ""}
                    {anon ? "Anonymous guest" : v.name}
                    {r.userId === u.id ? " (you)" : ""}
                  </strong>
                </div>
                <button
                  aria-label={"Boop " + (anon ? "guest" : v.name)}
                  aria-pressed={r.boops["⚡"]?.includes(u.id) ?? false}
                  onClick={() =>
                    change((d) =>
                      boop(
                        d.rsvps.find((g) => g.id === r.id)!.boops,
                        "⚡",
                        u.id,
                      ),
                    )
                  }
                >
                  ⚡ {r.boops["⚡"]?.length || "Boop"}
                </button>
              </div>
            );
          })
        ) : (
          <p>No guests in this list yet.</p>
        )}
      </section>
      <Wall e={e} />
      <Album e={e} host={host} />
      {host && <Host e={e} />}
      {modal === "rsvp" && <RsvpForm e={e} close={() => setModal("")} />}{" "}
      {modal === "poster" && <SharePoster e={e} close={() => setModal("")} />}{" "}
      {modal === "invite" && <Invites e={e} close={() => setModal("")} />}{" "}
      {modal === "calendar" && (
        <Modal title="Add to calendar" close={() => setModal("")}>
          <p>
            {e.title}
            <br />
            {when(e.startTime)}
          </p>
          <div className="hub-actions">
            <button onClick={() => downloadIcs(e)}>Download .ics</button>
            <a href={googleCalendar(e)} target="_blank" rel="noreferrer">
              Google Calendar
            </a>
          </div>
        </Modal>
      )}
    </article>
  );
}
