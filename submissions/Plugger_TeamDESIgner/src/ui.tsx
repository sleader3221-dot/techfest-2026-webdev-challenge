import { useEffect, useRef, type ReactNode } from "react";
const paths: Record<string, string> = {
  bolt: "m12 1-9 13h8l-2 9L22 8h-8l3-7z",
  pulse: "M1 12h5l3-8 5 16 4-10 2 2h3",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  out: "M6 18 18 6M7 6h11v11",
  map: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0",
  users:
    "M15 21v-3a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v3 M13 7a4 4 0 1 1-8 0 4 4 0 1 1 8 0 M16 4a4 4 0 0 1 0 7m2 4a5 5 0 0 1 3 5",
  calendar: "M3 5h18v16H3zM7 2v6m10-6v6M4 11h16",
  bell: "M3 17h18c-3-3-3-5-3-8a6 6 0 0 0-12 0c0 3 0 5-3 8zm7 3q2 3 4 0",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
  moon: "M21 14A9 9 0 0 1 10 3a9 9 0 1 0 11 11z",
  controls: "M3 6h7m4 0h7M3 18h11m4 0h3M10 3v6m6 6v6",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 1 1 12 0zm-1 5 6 6",
  save: "M6 3h12v18l-6-4-6 4z",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0zM12 6v6l4 2",
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 1 1 8 0zM3 21a9 8 0 0 1 18 0",
  discover: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0zm-6-4-2 6-5 2 2-6z",
  x: "M5 5l14 14M19 5 5 19",
  down: "m6 9 6 6 6-6",
};
export function Icon({
  name,
  size = 18,
  filled = false,
}: {
  name: string;
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.65}
      fill={filled || name === "bolt" ? "currentColor" : "none"}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      data-component="dialog"
      aria-label={title}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="between">
          <h2>{title}</h2>
          <button className="circle" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Segments({
  items,
  value,
  select,
  tabs = false,
}: {
  tabs?: boolean;
  items: string[];
  value: string;
  select: (x: string) => void;
}) {
  return (
    <div data-component="segmented-control" className="segments" role={tabs ? "tablist" : "group"} aria-label={tabs ? "Event feed" : undefined}>
      {items.map((x, i) => (
        <button
          key={x}
          role={tabs ? "tab" : undefined}
          aria-selected={tabs ? x === value : undefined}
          aria-pressed={tabs ? undefined : x === value}
          tabIndex={tabs ? (x === value ? 0 : -1) : undefined}
          onClick={() => select(x)}
          onKeyDown={(e) => {
            if (["ArrowRight", "ArrowLeft"].includes(e.key)) {
              e.preventDefault();
              const n =
                (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) %
                items.length;
              select(items[n]);
              (
                e.currentTarget.parentElement!.children[n] as HTMLElement
              ).focus();
            }
          }}
        >
          {x}
        </button>
      ))}
    </div>
  );
}

