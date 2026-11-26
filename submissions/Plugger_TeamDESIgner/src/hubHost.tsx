import { useState } from "react";
import { Link } from "react-router-dom";
import type { CampusEvent, EventSettings, RsvpRecord } from "./models";
import { useApp } from "./store";
import { Modal } from "./hubForms";
import {
  uid,
  stamp,
  notify,
  passCode,
  downloadCsv,
  labels,
  updateRsvp,
} from "./hubTools";
const switches: Partial<Record<keyof EventSettings, string>> = {
  isPublic: "Public event",
  rsvpsOpen: "Open RSVPs",
  requireApproval: "Require approval",
  allowGuestsInviteMutuals: "Guest invitations",
  anonymizeGuestList: "Anonymous guest list",
  hideGuestCount: "Hide guest count",
  hideActivityTimestamps: "Hide timestamps",
  allowPhotoUploads: "Photo uploads",
  autoRemindersEnabled: "Automatic reminders",
  allowBlastReplies: "Allow blast replies",
};
function Settings({ e }: { e: CampusEvent }) {
  const { s, change, toast } = useApp();
  const [settings, set] = useState(e.settings),
    [cohosts, setCo] = useState(e.coHostUserIds),
    [chip, setChip] = useState(e.chipIn);
  return (
    <form
      className="hub-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        change((d) => {
          const x = d.events.find((x) => x.id === e.id)!;
          x.settings = settings;
          x.coHostUserIds = cohosts;
          x.chipIn = chip;
          x.isFree = !chip.enabled && !x.ticketTiers.length;
        });
        toast("Event settings saved");
      }}
    >
      <fieldset>
        <legend>Access and privacy</legend>
        {(Object.keys(switches) as (keyof EventSettings)[]).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={!!settings[key]}
              onChange={(v) => set({ ...settings, [key]: v.target.checked })}
            />{" "}
            {switches[key]}
          </label>
        ))}
        <label>
          Event password
          <input
            value={settings.password ?? ""}
            onChange={(v) => set({ ...settings, password: v.target.value })}
          />
        </label>
        <label>
          Capacity
          <input
            type="number"
            min="1"
            value={settings.capacity ?? ""}
            onChange={(v) =>
              set({
                ...settings,
                capacity: v.target.value ? Number(v.target.value) : undefined,
              })
            }
          />
        </label>
        <label>
          Maximum plus-ones
          <input
            type="number"
            min="0"
            required
            value={settings.maxPlusOnes}
            onChange={(v) =>
              set({ ...settings, maxPlusOnes: Number(v.target.value) })
            }
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>Co-hosts</legend>
        {s.users
          .filter((v) => v.id !== e.hostUserId)
          .map((v) => (
            <label key={v.id}>
              <input
                type="checkbox"
                checked={cohosts.includes(v.id)}
                onChange={() =>
                  setCo(
                    cohosts.includes(v.id)
                      ? cohosts.filter((i) => i !== v.id)
                      : [...cohosts, v.id],
                  )
                }
              />{" "}
              {v.name}
            </label>
          ))}
      </fieldset>
      <fieldset>
        <legend>Chip-in</legend>
        <label>
          <input
            type="checkbox"
            checked={chip.enabled}
            onChange={(v) => setChip({ ...chip, enabled: v.target.checked })}
          />{" "}
          Request contributions
        </label>
        {chip.enabled && (
          <>
            <label>
              Contribution type
              <select
                value={chip.mode}
                onChange={(v) =>
                  setChip({ ...chip, mode: v.target.value as typeof chip.mode })
                }
              >
                <option value="required">Required</option>
                <option value="pay_what_you_can">Pay what you can</option>
              </select>
            </label>
            <label>
              Amount (₹)
              <input
                required={chip.mode === "required"}
                type="number"
                min="0"
                value={chip.amountInr ?? ""}
                onChange={(v) =>
                  setChip({ ...chip, amountInr: Number(v.target.value) })
                }
              />
            </label>
            <label>
              UPI ID
              <input
                value={chip.upiId ?? ""}
                onChange={(v) => setChip({ ...chip, upiId: v.target.value })}
              />
            </label>
            <label>
              Payment link
              <input
                type="url"
                value={chip.paymentLink ?? ""}
                onChange={(v) =>
                  setChip({ ...chip, paymentLink: v.target.value })
                }
              />
            </label>
          </>
        )}
      </fieldset>
      <div className="hub-actions">
        <button>Save settings</button>
        <Link to={"/organizer?edit=" + e.id}>Edit event</Link>
      </div>
    </form>
  );
}
function Blast({ e, close }: { e: CampusEvent; close: () => void }) {
  const { s, u, change, toast } = useApp(),
    [target, setTarget] = useState<"all" | "going" | "maybe" | "waitlist">(
      "all",
    ),
    [message, setMessage] = useState(""),
    [allow, setAllow] = useState(e.settings.allowBlastReplies);
  const audience = s.rsvps.filter(
    (r) => r.eventId === e.id && (target === "all" || target === r.status),
  );
  return (
    <Modal close={close} title="Send a text blast">
      <form
        className="hub-form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!message.trim()) return;
          change((d) => {
            d.events.find((x) => x.id === e.id)!.settings.allowBlastReplies =
              allow;
            d.activities.push({
              id: uid(),
              eventId: e.id,
              userId: u.id,
              type: "blast",
              text: message.trim(),
              pinned: true,
              targetAudience: target,
              createdAt: stamp(),
              boops: {},
              replies: [],
            });
            audience.forEach((r) =>
              notify(d, r.userId, e.id, e.title, message.trim()),
            );
          });
          toast("Blast sent to " + audience.length + " guests");
          close();
        }}
      >
        <label>
          Audience
          <select
            value={target}
            onChange={(v) => setTarget(v.target.value as typeof target)}
          >
            {["all", "going", "maybe", "waitlist"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <small>{audience.length} recipients</small>
        <label>
          Message
          <textarea
            maxLength={280}
            value={message}
            required
            onChange={(v) => setMessage(v.target.value)}
          />
        </label>
        <small>{message.length}/280</small>
        <label>
          <input
            type="checkbox"
            checked={allow}
            onChange={(v) => setAllow(v.target.checked)}
          />{" "}
          Allow replies
        </label>
        <button disabled={!message.trim()}>Send blast</button>
      </form>
    </Modal>
  );
}
export function Host({ e }: { e: CampusEvent }) {
  const { s, change, toast } = useApp(),
    [blast, setBlast] = useState(false),
    [search, setSearch] = useState(""),
    [scan, setScan] = useState(""),
    [feedback, setFeedback] = useState("");
  const guests = s.rsvps.filter((r) => r.eventId === e.id),
    going = guests.filter((r) => r.status === "going"),
    checked = going.filter((r) => r.checkedIn).length;
  const guestName = (r: RsvpRecord) => s.users.find((v) => v.id === r.userId)!;
  const toggle = (id: string, on: boolean) =>
    change((d) => {
      const r = d.rsvps.find((v) => v.id === id)!;
      r.checkedIn = on;
      r.checkedInAt = on ? stamp() : undefined;
    });
  return (
    <section id="host" data-component="host-controls">
      <h2>Host controls</h2>
      <div className="hub-actions">
        <button onClick={() => setBlast(true)}>Text blast</button>
        <button onClick={() => downloadCsv(e, s)}>Export CSV</button>
        <Link to={"/organizer?edit=" + e.id}>Edit event</Link>
      </div>
      {blast && <Blast e={e} close={() => setBlast(false)} />}
      <details>
        <summary>Manage guests</summary>
        {guests.length ? (
          guests.map((r) => (
            <div className="hub-line" key={r.id}>
              <div>
                <strong>{guestName(r).name}</strong>
                <p>{labels[r.status]}</p>
              </div>
              <div className="hub-actions">
                {r.status !== "going" && (
                  <button
                    onClick={() => {
                      change((d) =>
                        updateRsvp(d, e.id, r.userId, "going", { host: true }),
                      );
                      toast("Guest marked Going");
                    }}
                  >
                    {r.status === "pending" ? "Approve" : "Promote"}
                  </button>
                )}
                {r.status !== "waitlist" && (
                  <button
                    onClick={() =>
                      change((d) =>
                        updateRsvp(d, e.id, r.userId, "waitlist", {
                          host: true,
                        }),
                      )
                    }
                  >
                    Move to waitlist
                  </button>
                )}
                {r.status !== "declined" && (
                  <button
                    onClick={() =>
                      change((d) =>
                        updateRsvp(d, e.id, r.userId, "declined", {
                          host: true,
                        }),
                      )
                    }
                  >
                    Decline
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>No guest requests yet.</p>
        )}
      </details>
      <details>
        <summary>Check-in</summary>
        <h3>
          {checked} / {going.length} checked in
        </h3>
        <progress data-component="progress-fill" value={checked} max={Math.max(1, going.length)} />
        <form
          className="hub-form"
          onSubmit={(ev) => {
            ev.preventDefault();
            const v = scan.trim().toLowerCase(),
              r = going.find((x) =>
                [passCode(x), guestName(x).name, guestName(x).usn].some(
                  (t) => t.toLowerCase() === v,
                ),
              );
            if (!r) {
              setFeedback("No going guest matches that code, name or USN.");
              return;
            }
            if (r.checkedIn) {
              setFeedback(guestName(r).name + " already checked in.");
              return;
            }
            toggle(r.id, true);
            setFeedback(guestName(r).name + " checked in.");
            setScan("");
          }}
        >
          <label>
            Simulate QR scan
            <input
              placeholder="Pass code, full name or USN"
              value={scan}
              onChange={(v) => setScan(v.target.value)}
            />
          </label>
          <button disabled={!scan.trim()}>Check in guest</button>
          <p role="status">{feedback}</p>
        </form>
        <label>
          Find a guest
          <input value={search} onChange={(v) => setSearch(v.target.value)} />
        </label>
        {going
          .filter((r) =>
            (guestName(r).name + " " + guestName(r).usn)
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((r) => (
            <label className="hub-line" key={r.id}>
              <span>{guestName(r).name}</span>
              <input
                type="checkbox"
                checked={r.checkedIn}
                onChange={(v) => toggle(r.id, v.target.checked)}
              />
            </label>
          ))}
      </details>
      <details>
        <summary>Event settings</summary>
        <Settings e={e} />
      </details>
    </section>
  );
}
