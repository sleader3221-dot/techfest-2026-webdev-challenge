import { useLayoutEffect, useRef } from "react";
import assets from "../../assetManifest.json";
import { useChatTimeline } from "./useChatTimeline";
import "../../styles/components/chat-demo.css";

const messages = [
  ["u3", "what's on this friday???"],
  ["u2", "nothing yet lol"],
  ["u1", "hackathon @ apex?"],
  ["u1", null],
  ["u3", "wait... perfect"],
  ["u2", "LET'S GOOOO"],
  ["u1", "c u there"],
] as const;

// Vite checks the optional photo at build time, avoiding a missing-image request.
const hasPhoto =
  Object.keys(
    import.meta.glob("/public/assets/landing/hero-photo.jpg", {
      query: "?url",
    }),
  ).length > 0;

function InviteCard() {
  return (
    <div data-slot="chat-invite">
      <div className="chat-poster">
        <img src={assets.posters.e5} alt="" />
        <span>plugged · RIT</span>
      </div>
      <div className="chat-invite-info">
        <img src="/assets/brand/icon-192.png" alt="" width="40" height="40" />
        <div>
          <strong>RSVP to Overnight Mini-Hackathon</strong>
          <small>CodeRIT · Plugged</small>
        </div>
        <span className="chat-view" aria-hidden="true">
          View
        </span>
      </div>
    </div>
  );
}

export function ChatHeroDemo() {
  const { stage, count, typing, fading, reduced, playing } = useChatTimeline();
  const stack = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = stack.current!;
    const rows = Array.from(container.children) as HTMLElement[];
    // Measure actual bubble heights so wrapping, fonts and zoom preserve the stack.
    const place = () => {
      const gap = parseFloat(getComputedStyle(container).rowGap);
      const heights = rows.map((row) => row.offsetHeight);
      const available = container.clientHeight - 2 * gap;
      const completeFits =
        heights.reduce((sum, h) => sum + h + gap, -gap) <= available;
      let offset = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        const fits = offset + heights[i] <= available + 1;
        const visible =
          fits && ((reduced && completeFits) || rows.length - i <= 5);
        rows[i].style.transform = "translateY(" + -offset + "px)";
        rows[i].style.opacity = visible ? "1" : "0";
        offset += heights[i] + gap;
      }
    };
    place();
    const resize = new ResizeObserver(place);
    [container, ...rows].forEach((node) => resize.observe(node));
    return () => resize.disconnect();
  }, [count, typing, reduced]);
  return (
    <div className="chat-wrap">
      <span className="chat-summary">
        Preview of a group chat. Friends ask what's on this Friday, share the
        overnight mini-hackathon invite, and agree to go.
      </span>
      <div
        ref={stage}
        data-component="chat-demo"
        aria-hidden="true"
        data-playing={playing}
      >
        <div className="chat-backdrop">
          {hasPhoto ? (
            <img src="/assets/landing/hero-photo.jpg" alt="" />
          ) : (
            <div className="chat-shapes">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
        <div ref={stack} data-slot="chat-stack" data-fading={!!fading}>
          {messages.slice(0, count).map(([sender, text], index) => {
            const composing = typing && index === count - 1;
            return (
              <div
                className="chat-row"
                key={index}
                data-variant={sender === "u1" ? "sent" : "received"}
              >
                <img
                  className="chat-avatar"
                  src={assets.avatars[sender]}
                  alt=""
                />
                <div
                  key={composing ? "typing" : "message"}
                  className="chat-pop"
                >
                  {composing ? (
                    <div className="chat-bubble" data-slot="chat-typing">
                      <i />
                      <i />
                      <i />
                    </div>
                  ) : text ? (
                    <div className="chat-bubble">{text}</div>
                  ) : (
                    <InviteCard />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
