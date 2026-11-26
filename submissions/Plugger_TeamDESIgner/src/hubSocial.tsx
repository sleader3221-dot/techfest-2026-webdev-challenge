import assets from "./assetManifest.json";
import { useState } from "react";
import type { AppState, CampusEvent, ActivityItem, PhotoItem } from "./models";
import { useApp } from "./store";
import { Modal } from "./hubForms";
import { uid, stamp, when, resizeImage, notify } from "./hubTools";

export const reactions = ["⚡", "🔥", "♥", "👏"];
export function boop(
  record: Record<string, string[]>,
  emoji: string,
  id: string,
) {
  const list = record[emoji] ?? [];
  record[emoji] = list.includes(id)
    ? list.filter((i) => i !== id)
    : [...list, id];
}
const stickerImages: Record<string, string> = {
  "Boop": assets.stickers.boop,
  "Let's go!": assets.stickers["lets-go"],
  "Fire": assets.stickers.fire,
  "GG": assets.stickers.gg,
  "Vibes": assets.stickers.vibes,
  "Late night": assets.stickers["late-night"],
};
const stickers = Object.keys(stickerImages);
export function mutualIds(s: AppState, id: string) {
  const mine = new Set(
    s.rsvps
      .filter((r) => r.userId === id && r.status === "going")
      .map((r) => r.eventId),
  );
  return s.users
    .filter((u) => u.id !== id)
    .map((user) => ({
      user,
      count: s.rsvps.filter(
        (r) =>
          r.userId === user.id && r.status === "going" && mine.has(r.eventId),
      ).length,
    }))
    .filter((x) => x.count)
    .sort((a, b) => b.count - a.count);
}
export function Invites({ e, close }: { e: CampusEvent; close: () => void }) {
  const { s, u, change, toast } = useApp(),
    [selected, setSelected] = useState<string[]>([]),
    options = mutualIds(s, u.id).filter(
      (x) =>
        !s.rsvps.some(
          (r) =>
            r.eventId === e.id &&
            r.userId === x.user.id &&
            r.status === "going",
        ),
    );
  return (
    <Modal title="Invite mutuals" close={close}>
      {options.length ? (
        <div className="hub-form">
          <button
            onClick={() =>
              setSelected(
                selected.length === options.length
                  ? []
                  : options.map((x) => x.user.id),
              )
            }
          >
            {selected.length === options.length
              ? "Clear selection"
              : "Select all"}
          </button>
          {options.map((x) => (
            <label key={x.user.id}>
              <input
                type="checkbox"
                checked={selected.includes(x.user.id)}
                onChange={() =>
                  setSelected(
                    selected.includes(x.user.id)
                      ? selected.filter((i) => i !== x.user.id)
                      : [...selected, x.user.id],
                  )
                }
              />{" "}
              {x.user.name} · {x.count} shared events
            </label>
          ))}
          <button
            className="hub-primary"
            disabled={!selected.length}
            onClick={() => {
              change((d) =>
                selected.forEach((id) =>
                  notify(
                    d,
                    id,
                    e.id,
                    "Invitation to " + e.title,
                    u.name + " invited you.",
                  ),
                ),
              );
              toast(selected.length + " invites sent");
              close();
            }}
          >
            Send invites
          </button>
        </div>
      ) : (
        <p>
          Your mutuals are already on the list, or you haven’t shared any events
          yet.
        </p>
      )}
    </Modal>
  );
}
function WallItem({ item, e }: { item: ActivityItem; e: CampusEvent }) {
  const { s, u, change } = useApp(),
    [reply, setReply] = useState(""),
    [open, setOpen] = useState(false);
  const user = s.users.find((v) => v.id === item.userId),
    find = (d: AppState) => d.activities.find((v) => v.id === item.id)!;
  return (
    <article className="hub-post">
      <header>
        <strong>{item.type === "system" ? "Plugged" : user?.name}</strong>
        {item.pinned && <span className="hub-tag">Host blast</span>}
        {!e.settings.hideActivityTimestamps && (
          <small>{when(item.createdAt)}</small>
        )}
      </header>
      {item.text && <p>{item.text}</p>}
      {item.gifDataUrl && (
        <img
          className="hub-sticker"
          src={item.gifDataUrl}
          alt={item.gifLabel}
        />
      )}{" "}
      {item.imageDataUrl && (
        <img
          className="hub-attachment"
          src={item.imageDataUrl}
          alt={"Photo by " + user?.name}
        />
      )}
      {item.type !== "system" && (
        <div className="hub-actions">
          {reactions.map((x) => (
            <button
              key={x}
              aria-label={"React " + x}
              aria-pressed={item.boops[x]?.includes(u.id) ?? false}
              onClick={() => change((d) => boop(find(d).boops, x, u.id))}
            >
              {x} {item.boops[x]?.length || ""}
            </button>
          ))}
          {(item.type !== "blast" || e.settings.allowBlastReplies) && (
            <button onClick={() => setOpen(!open)}>Reply</button>
          )}
        </div>
      )}
      {item.replies.map((r) => (
        <blockquote key={r.id}>
          <strong>{s.users.find((v) => v.id === r.userId)?.name}</strong>
          <p>{r.text}</p>
        </blockquote>
      ))}
      {open && (
        <form
          className="hub-actions"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!reply.trim()) return;
            change((d) =>
              find(d).replies.push({
                id: uid(),
                userId: u.id,
                text: reply.trim(),
                createdAt: stamp(),
              }),
            );
            setOpen(false);
            setReply("");
          }}
        >
          <input
            aria-label="Reply"
            value={reply}
            onChange={(ev) => setReply(ev.target.value)}
          />
          <button disabled={!reply.trim()}>Post reply</button>
        </form>
      )}
    </article>
  );
}
export function Wall({ e }: { e: CampusEvent }) {
  const { s, u, change, toast } = useApp(),
    [text, setText] = useState(""),
    [gif, setGif] = useState(""),
    [picker, setPicker] = useState(false),
    [photo, setPhoto] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = s.activities
    .filter((i) => i.eventId === e.id)
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <section data-component="activity-wall">
      <h2>Activity wall</h2>
      <form
        className="hub-form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (busy || (!text.trim() && !photo && !gif)) return;
          change((d) =>
            d.activities.push({
              id: uid(),
              eventId: e.id,
              userId: u.id,
              type: "comment",
              text: text.trim(),
              gifLabel: gif || undefined,
              gifDataUrl: gif ? stickerImages[gif] : undefined,
              imageDataUrl: photo || undefined,
              createdAt: stamp(),
              boops: {},
              replies: [],
            }),
          );
          setText("");
          setGif("");
          setPhoto("");
          setPicker(false);
          toast("Posted to the wall");
        }}
      >
        <label>
          Leave a comment
          <textarea
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            placeholder="Say something to the crew…"
          />
        </label>
        {gif && (
          <button type="button" onClick={() => setGif("")}>
            Remove sticker · {gif}
          </button>
        )}
        {photo && (
          <div>
            <img className="hub-attachment" src={photo} alt="Attached photo" />
            <button type="button" onClick={() => setPhoto("")}>
              Remove photo
            </button>
          </div>
        )}
        <div className="hub-actions">
          <button type="button" onClick={() => setPicker(!picker)}>
            GIF stickers
          </button>
          {e.settings.allowPhotoUploads && (
            <label className="hub-file">
              Attach photo
              <input
                type="file"
                accept="image/*"
                onChange={async (ev) => {
                  const f = ev.target.files?.[0];
                  ev.target.value = "";
                  if (!f) return;
                  setBusy(true);
                  try {
                    setPhoto(await resizeImage(f));
                  } catch {
                    toast("Unable to read this image");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          )}
          <button
            className="hub-primary"
            disabled={busy || (!text.trim() && !gif && !photo)}
          >
            Post
          </button>
        </div>
        {picker && (
          <div className="hub-actions">
            {stickers.map((g) => (
              <button
                type="button"
                key={g}
                onClick={() => {
                  setGif(g);
                  setPicker(false);
                }}
              >
                <img className="hub-sticker" alt={g} src={stickerImages[g]} />
              </button>
            ))}
          </div>
        )}
      </form>
      {rows.length ? (
        rows.map((item) => <WallItem key={item.id} e={e} item={item} />)
      ) : (
        <p>Be the first to post.</p>
      )}
    </section>
  );
}
export function Album({ e, host }: { e: CampusEvent; host: boolean }) {
  const { s, u, change, toast } = useApp(),
    [view, setView] = useState<PhotoItem | null>(null),
    [caption, setCaption] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false);
  const photos = s.photos.filter((p) => p.eventId === e.id);
  return (
    <section data-component="photo-album">
      <h2>Photo album</h2>
      {photos.length ? (
        <div className="hub-photos">
          {photos.map((p) => (
            <button
              key={p.id}
              aria-label={p.caption || "View event photo"}
              onClick={() => setView(p)}
            >
              <img
                src={p.imageDataUrl}
                alt={p.caption || "Event photo"}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : (
        <p>No photos yet.</p>
      )}
      {(host || e.settings.allowPhotoUploads) && (
        <form
          className="hub-form"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (!file) return;
            const form = ev.currentTarget;
            setBusy(true);
            try {
              const imageDataUrl = await resizeImage(file);
              change((d) =>
                d.photos.push({
                  id: uid(),
                  eventId: e.id,
                  userId: u.id,
                  imageDataUrl,
                  caption: caption.trim(),
                  uploadedAt: stamp(),
                }),
              );
              setFile(null);
              setCaption("");
              form.reset();
              toast("Photo added");
            } catch {
              toast("Unable to read this image");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Photo
            <input
              type="file"
              accept="image/*"
              required
              onChange={(v) => setFile(v.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            Caption
            <input
              value={caption}
              onChange={(v) => setCaption(v.target.value)}
            />
          </label>
          <button disabled={busy || !file}>
            {busy ? "Processing…" : "Upload photo"}
          </button>
        </form>
      )}
      {view && (
        <Modal
          title={view.caption || "Event photo"}
          close={() => setView(null)}
        >
          <img
            className="hub-full"
            src={view.imageDataUrl}
            alt={view.caption || "Event photo"}
          />
          <p>Photo by {s.users.find((v) => v.id === view.userId)?.name}</p>
        </Modal>
      )}
    </section>
  );
}
