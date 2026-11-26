import { useEffect, useRef, useState } from "react";

// The count includes a typing row while its sender is composing.
const steps = [
  { at: 0, count: 1, typing: true },
  { at: 1200, count: 1 },
  { at: 2400, count: 2, typing: true },
  { at: 3200, count: 2 },
  { at: 4500, count: 3 },
  { at: 5600, count: 4 },
  { at: 7000, count: 5, typing: true },
  { at: 7700, count: 5 },
  { at: 8200, count: 6, typing: true },
  { at: 8800, count: 6 },
  { at: 10200, count: 7 },
  { at: 13000, count: 7, fading: true },
];
const loopLength = 13800;
const preference = "(prefers-reduced-motion: reduce)";

export function useChatTimeline() {
  const stage = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia(preference).matches);

  useEffect(() => {
    const motion = matchMedia(preference);
    let inView = false;
    let elapsed = 0;
    let started: number | null = null;
    let timer: number | undefined;

    function schedule() {
      if (started === null) return;
      const time = (elapsed + performance.now() - started) % loopLength;
      const next = steps.findIndex((s) => s.at > time);
      setStep(next === -1 ? steps.length - 1 : next - 1);
      timer = window.setTimeout(
        schedule,
        Math.ceil((steps[next]?.at ?? loopLength) - time),
      );
    }
    function update() {
      window.clearTimeout(timer);
      if (started !== null) elapsed += performance.now() - started;
      started = null;
      const active = inView && !document.hidden && !motion.matches;
      setReduced(motion.matches);
      setPlaying(active);
      if (motion.matches) {
        elapsed = 0;
        setStep(0);
      }
      if (active) {
        started = performance.now();
        schedule();
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.intersectionRatio >= 0.4;
        update();
      },
      { threshold: [0, 0.4] },
    );
    observer.observe(stage.current!);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return { stage, playing, reduced, ...(reduced ? steps[10] : steps[step]) };
}
