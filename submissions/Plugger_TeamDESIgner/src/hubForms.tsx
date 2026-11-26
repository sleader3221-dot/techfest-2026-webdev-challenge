import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CampusEvent, RsvpRecord } from "./models";
import { useApp } from "./store";
import {
  activity,
  when,
  overlaps,
  labels,
  notify,
  seats,
  updateRsvp,
  stamp,
  passCode,
  passImage,
  saveFile,
} from "./hubTools";
import { poster } from "./media";

export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      data-component="hub-dialog"
      ref={ref}
      aria-label={title}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="hub-dialog-inner">
        <div className="hub-row">
          <h2>{title}</h2>
          <button
            className="hub-close"
            onClick={close}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function EntryPass({ e, r }: { e: CampusEvent; r: RsvpRecord }) {
  const code = passCode(r);
  return (
    <div data-component="entry-pass" data-slot="pass-top">
      <img
        alt="Visual entry pass"
        width="104"
        height="104"
        src={passImage(code)}
      />
      <div>
        <small>ENTRY PASS</small>
        <h3>
          {e.ticketTiers.find((t) => t.id === r.ticketTierId)?.name ??
            "Guest admission"}
        </h3>
        <code>{code}</code>
        {r.plusOneNames.length > 0 && (
          <p>Guests: {r.plusOneNames.join(", ")}</p>
        )}
      </div>
    </div>
  );
}
export function RsvpForm({ e, close }: { e: CampusEvent; close: () => void }) {
  const { s, u, change, toast } = useApp(),
    mine = s.rsvps.find((r) => r.userId === u.id && r.eventId === e.id);
  const conflicts = s.events.filter(
    (x) =>
      overlaps(e, x) &&
      s.rsvps.some(
        (r) => r.userId === u.id && r.eventId === x.id && r.status === "going",
      ),
  );
  const [ack, setAck] = useState(false),
    [names, setNames] = useState<string[]>(mine?.plusOneNames ?? []),
    [answers, setAnswers] = useState(mine?.questionnaireAnswers ?? {});
  const [tier, setTier] = useState(
      mine?.ticketTierId ?? e.ticketTiers[0]?.id ?? "",
    ),
    [promo, setPromo] = useState(mine?.promoCodeUsed ?? "");
  const [paid, setPaid] = useState(mine?.chipInConfirmed ?? false),
    [contribution, setContribution] = useState(
      String(e.chipIn.amountInr ?? mine?.amountPaidInr ?? 0),
    );
  const ticket = e.ticketTiers.find((t) => t.id === tier),
    discount = e.promoCodes.find(
      (p) => p.code.toUpperCase() === promo.trim().toUpperCase(),
    );
  const quantity = 1 + names.length,
    cost = (ticket?.priceInr ?? 0) * quantity,
    total =
      Math.round(cost * (100 - (discount?.discountPercent ?? 0))) / 100 +
      (e.chipIn.enabled ? Number(contribution) : 0);
  let reason = "";
  if (conflicts.length && !ack)
    reason = "Confirm that you can attend both events.";
  else if (names.some((n) => !n.trim()))
    reason = "Enter a name for each guest.";
  else if (e.questionnaire.some((q) => q.required && !answers[q.id]?.trim()))
    reason = "Answer the required questions.";
  else if (
    ticket &&
    ticket.capacity -
      ticket.soldCount +
      (mine?.status === "going" && mine.ticketTierId === tier
        ? seats(mine)
        : 0) <
      quantity
  )
    reason = "This ticket tier has too few places.";
  else if (promo.trim() && !discount)
    reason = "Enter a valid promo code or clear the field.";
  else if (
    e.chipIn.enabled &&
    (!paid || !contribution || Number(contribution) < 0)
  )
    reason = "Enter your contribution and confirm payment.";
  return (
    <Modal title="Your RSVP" close={close}>
      <p>{e.title}</p>
      <form
        className="hub-form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (reason) return;
          const options = {
            plusOneNames: names.map((n) => n.trim()),
            questionnaireAnswers: answers,
            ticketTierId: tier || undefined,
            promoCodeUsed: discount?.code,
            amountPaidInr: total,
            chipInConfirmed: paid,
          };
          const projection = structuredClone(s),
            status = updateRsvp(projection, e.id, u.id, "going", options);
          change((d) => {
            updateRsvp(d, e.id, u.id, "going", options);
          });
          toast(
            status === "going"
              ? "You're going!"
              : status === "pending"
                ? "Request sent for approval"
                : "Added to waitlist (#" +
                  (1 +
                    projection.rsvps
                      .filter(
                        (r) => r.eventId === e.id && r.status === "waitlist",
                      )
                      .sort((a, b) =>
                        a.firstRsvpAt.localeCompare(b.firstRsvpAt),
                      )
                      .findIndex((r) => r.userId === u.id)) +
                  ")",
          );
          close();
        }}
      >
        {conflicts.length > 0 && (
          <fieldset>
            <legend>Schedule clash</legend>
            {conflicts.map((x) => (
              <p key={x.id}>
                {x.title}
                <br />
                <small>
                  {when(x.startTime)} – {when(x.endTime)}
                </small>
              </p>
            ))}
            <label>
              <input
                type="checkbox"
                checked={ack}
                onChange={(v) => setAck(v.target.checked)}
              />{" "}
              Go anyway
            </label>
          </fieldset>
        )}
        {e.settings.maxPlusOnes > 0 && (
          <fieldset>
            <legend>Bring guests</legend>
            {names.map((n, i) => (
              <label key={i}>
                Guest {i + 1}
                <span className="hub-actions">
                  <input
                    required
                    value={n}
                    onChange={(v) =>
                      setNames(
                        names.map((a, j) => (i === j ? v.target.value : a)),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setNames(names.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </span>
              </label>
            ))}
            <button
              type="button"
              disabled={names.length >= e.settings.maxPlusOnes}
              onClick={() => setNames([...names, ""])}
            >
              Add a guest
            </button>
          </fieldset>
        )}
        {e.questionnaire.map((q) => (
          <label key={q.id}>
            {q.label}
            {q.required ? " *" : ""}
            {q.type === "dropdown" ? (
              <select
                value={answers[q.id] ?? ""}
                onChange={(v) =>
                  setAnswers({ ...answers, [q.id]: v.target.value })
                }
              >
                <option value="">Choose an answer</option>
                {q.options?.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                value={answers[q.id] ?? ""}
                onChange={(v) =>
                  setAnswers({ ...answers, [q.id]: v.target.value })
                }
              />
            )}
          </label>
        ))}
        {e.ticketTiers.length > 0 && (
          <fieldset>
            <legend>Tickets</legend>
            <label>
              Ticket tier
              <select value={tier} onChange={(v) => setTier(v.target.value)}>
                {e.ticketTiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · ₹{t.priceInr}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Promo code
              <input value={promo} onChange={(v) => setPromo(v.target.value)} />
            </label>
            {discount && (
              <p>
                {discount.discountPercent}% off · ₹
                {((cost * discount.discountPercent) / 100).toFixed(2)} saved
              </p>
            )}
          </fieldset>
        )}
        {e.chipIn.enabled && (
          <fieldset>
            <legend>Chip in</legend>
            {e.chipIn.mode === "required" ? (
              <p>Contribution · ₹{contribution}</p>
            ) : (
              <label>
                Contribution (₹)
                <input
                  type="number"
                  min="0"
                  value={contribution}
                  onChange={(v) => setContribution(v.target.value)}
                />
              </label>
            )}
            <p>{e.chipIn.upiId}</p>
            {e.chipIn.upiId && (
              <button
                type="button"
                onClick={() => copy(e.chipIn.upiId!, toast)}
              >
                Copy UPI ID
              </button>
            )}
            {e.chipIn.paymentLink &&
              /^(upi:|https:\/\/)/i.test(e.chipIn.paymentLink) && (
                <a href={e.chipIn.paymentLink} target="_blank" rel="noreferrer">
                  Open payment link
                </a>
              )}
            <label>
              <input
                type="checkbox"
                checked={paid}
                onChange={(v) => setPaid(v.target.checked)}
              />{" "}
              I’ve completed payment
            </label>
          </fieldset>
        )}
        {e.settings.requireApproval && (
          <p>The host will review your request.</p>
        )}
        <div className="hub-row">
          <strong>
            {total ? "Total · ₹" + total.toFixed(2) : "Free admission"}
          </strong>
          <button className="hub-primary" disabled={!!reason}>
            Confirm RSVP
          </button>
        </div>
        {reason && <small role="status">{reason}</small>}
        <button type="button" onClick={close}>
          Cancel
        </button>
      </form>
    </Modal>
  );
}
export async function copy(value: string, toast: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    toast("Copied to clipboard");
  } catch {
    toast("Clipboard unavailable. Select and copy the text manually.");
  }
}
export function Poll({ e, host }: { e: CampusEvent; host: boolean }) {
  const { s, u, change, toast } = useApp(),
    [choice, setChoice] = useState(""),
    max = Math.max(...e.datePollOptions.map((o) => o.voterUserIds.length));
  return (
    <section>
      <h2>Vote on a date</h2>
      {e.datePollOptions.map((o) => (
        <div className="hub-line" data-state={max > 0 && max === o.voterUserIds.length ? "leading" : "default"} key={o.id}>
          <div>
            <strong>{when(o.startTime)}</strong>
            <p>
              {o.voterUserIds.length} votes{" "}
              {max > 0 && max === o.voterUserIds.length ? "· Leading" : ""}
            </p>
            <div className="avatar-line">
              {o.voterUserIds
                .map((id) => s.users.find((v) => v.id === id))
                .filter((v) => !!v)
                .map((v) => (
                  <img
                    key={v.id}
                    src={v.avatarUrl}
                    width="28"
                    height="28"
                    alt={v.name}
                    title={v.name}
                  />
                ))}
            </div>
          </div>
          <button
            aria-pressed={o.voterUserIds.includes(u.id)}
            onClick={() =>
              change((d) => {
                const p = d.events
                  .find((x) => x.id === e.id)!
                  .datePollOptions.find((x) => x.id === o.id)!;
                p.voterUserIds = p.voterUserIds.includes(u.id)
                  ? p.voterUserIds.filter((id) => id !== u.id)
                  : [...p.voterUserIds, u.id];
              })
            }
          >
            {o.voterUserIds.includes(u.id) ? "Voted" : "Vote"}
          </button>
          {host && (
            <button onClick={() => setChoice(o.id)}>Finalize date</button>
          )}
        </div>
      ))}
      {choice && (
        <Modal title="Finalize this date?" close={() => setChoice("")}>
          <p>
            Guests who voted for{" "}
            {when(e.datePollOptions.find((o) => o.id === choice)!.startTime)}{" "}
            will be marked Going.
          </p>
          <button
            onClick={() => {
              change((d) => {
                const event = d.events.find((x) => x.id === e.id)!,
                  opt = event.datePollOptions.find((x) => x.id === choice)!;
                event.isPollMode = false;
                event.startTime = opt.startTime;
                event.endTime = opt.endTime;
                event.isSeed = false;
                for (const id of opt.voterUserIds)
                  updateRsvp(d, e.id, id, "going", { host: true });
                activity(d, e.id, "The host finalized the event date.");
              });
              toast("Date finalized");
              setChoice("");
            }}
          >
            Confirm date
          </button>
        </Modal>
      )}
    </section>
  );
}
export function SharePoster({
  e,
  close,
}: {
  e: CampusEvent;
  close: () => void;
}) {
  const { s, toast } = useApp(),
    ref = useRef<HTMLCanvasElement>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const draw = async () => {
      await Promise.all([
        document.fonts.load('700 64px "Inter Tight"'),
        document.fonts.load("400 24px Inter"),
      ]);
      const img = new Image();
      img.src = poster(e);
      await img.decode();
      if (!alive) return;
      const c = ref.current!.getContext("2d")!;
      c.fillStyle = "black";
      c.fillRect(0, 0, 1080, 1350);
      const ratio = Math.max(1080 / img.width, 670 / img.height);
      c.save();
      c.beginPath();
      c.rect(0, 0, 1080, 670);
      c.clip();
      c.drawImage(
        img,
        (1080 - img.width * ratio) / 2,
        (670 - img.height * ratio) / 2,
        img.width * ratio,
        img.height * ratio,
      );
      c.restore();
      c.fillStyle = "white";
      c.font = "400 25px Inter";
      c.fillText(
        (
          s.clubs.find((a) => a.id === e.clubId)?.name +
          " / " +
          e.category
        ).toUpperCase(),
        48,
        732,
        980,
      );
      c.font = '700 72px "Inter Tight", sans-serif';
      let line = "",
        y = 835;
      for (const word of e.title.toUpperCase().split(/\s+/)) {
        if (line && c.measureText(line + " " + word).width > 980) {
          c.fillText(line, 48, y, 980);
          y += 76;
          line = "";
        }
        line += (line ? " " : "") + word;
      }
      c.fillText(line, 48, y, 980);
      c.font = "400 32px Inter";
      [
        e.isPollMode ? "Date poll open" : when(e.startTime),
        e.venue.name,
        ...(e.settings.hideGuestCount
          ? []
          : [
              s.rsvps
                .filter((g) => g.eventId === e.id && g.status === "going")
                .reduce((n, g) => n + seats(g), 0) + " going",
            ]),
      ].forEach((t, i) => c.fillText(t, 48, 1075 + i * 45, 980));
      c.font = "400 25px Inter";
      c.fillText("RSVP ON PLUGGED / RIT BENGALURU", 48, 1290);
      setReady(true);
    };
    draw().catch(() => {
      if (alive) setError("Unable to render this poster.");
    });
    return () => {
      alive = false;
    };
  }, [e, s.clubs, s.rsvps]);
  return (
    <Modal title="Share poster card" close={close}>
      <canvas
        ref={ref}
        width="1080"
        height="1350"
        aria-label={e.title + " event poster"}
      />
      {!ready && <p role="status">{error || "Rendering poster…"}</p>}
      <div className="hub-actions">
        <button
          disabled={!ready}
          onClick={() =>
            ref.current?.toBlob((blob) => {
              if (blob) saveFile(blob, e.id + "-poster.png");
            })
          }
        >
          Download PNG
        </button>
        <button onClick={() => copy(location.href, toast)}>
          Copy invite link
        </button>
      </div>
    </Modal>
  );
}
export { labels, notify, stamp };
