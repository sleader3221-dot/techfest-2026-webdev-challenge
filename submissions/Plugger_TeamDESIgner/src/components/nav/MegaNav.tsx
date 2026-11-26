import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { Link, NavLink } from "react-router-dom";
import { useApp } from "../../store";
import { Icon } from "../../ui";
import { buildMenus, destinations, type Item } from "./megaMenuContent";
import { useHoverIntent } from "./useHoverIntent";
import "../../styles/components/mega-nav.css";

function MenuItem({ item, close }: { item: Item; close: () => void }) {
  const content = (
    <>
      {item.image && <img src={item.image} alt="" width="32" height="32" />}
      <span>
        {item.label}
        {item.detail && <small>{item.detail}</small>}
      </span>
    </>
  );
  if (item.to)
    return (
      <Link className="mega-link" to={item.to} onClick={close}>
        {content}
      </Link>
    );
  return (
    <button
      className="mega-link"
      onClick={() => {
        close();
        item.action?.();
      }}
    >
      {content}
    </button>
  );
}
export function MegaNav({ onDemo }: { onDemo: () => void }) {
  const { s, u, now, change } = useApp();
  const intent = useHoverIntent(),
    { active, enabled, nav, close } = intent;
  const list = useRef<HTMLUListElement>(null);
  const menus = useMemo(
    () =>
      enabled
        ? buildMenus(s, u, now, {
            theme: () =>
              change((d) => {
                d.themePref = d.themePref === "dark" ? "light" : "dark";
              }),
            demo: onDemo,
            organize: () =>
              change((d) => {
                d.activeRole = "organizer";
              }),
          })
        : [],
    [enabled, s, u, now, onDemo, change],
  );
  useLayoutEffect(() => {
    const root = nav.current;
    if (active === null || !root || !list.current) return;
    const trigger = intent.triggers()[active],
      panel = document.getElementById("mega-panel-" + active)!;
    const measure = () => {
      root.style.setProperty("--mega-height", panel.offsetHeight + "px");
      root.style.setProperty("--trigger-x", trigger.offsetLeft + "px");
      root.style.setProperty("--trigger-width", trigger.offsetWidth + "px");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(list.current);
    return () => observer.disconnect();
  }, [active, enabled, nav]);
  if (!enabled)
    return (
      <nav
        data-component="navigation"
        data-variant="desktop"
        className="pill-nav"
        aria-label="Main navigation"
      >
        {destinations.map(([name, path]) => (
          <NavLink key={name} end={path === "/"} to={path}>
            {name}
          </NavLink>
        ))}
      </nav>
    );
  return (
    <nav
      ref={nav}
      data-component="mega-nav"
      data-open={active !== null}
      aria-label="Main navigation"
    >
      <div
        className="mega-scrim"
        aria-hidden="true"
        onPointerEnter={intent.leave}
        onClick={close}
      />
      <div className="mega-surface" aria-hidden="true" />
      <ul ref={list} className="mega-triggers">
        {destinations.map(([name, path], i) => {
          const menu = menus[i],
            expanded = active === i;
          return (
            <li key={name}>
              <NavLink
                id={"mega-trigger-" + i}
                data-slot="mega-trigger"
                aria-controls={"mega-panel-" + i}
                aria-expanded={expanded}
                end={path === "/"}
                to={path}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "touch") intent.hover(i);
                }}
                onPointerLeave={() => {
                  if (active === null) intent.cancel();
                }}
                onFocus={() => intent.focus(i)}
                onClick={close}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    intent.open(i);
                    requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLElement>(
                          "#mega-panel-" + i + " .mega-link",
                        )
                        ?.focus(),
                    );
                  } else if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    const n = destinations.length;
                    const j =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? n - 1
                          : (i + (e.key === "ArrowLeft" ? -1 : 1) + n) % n;
                    intent.triggers()[j].focus();
                  }
                }}
              >
                {name}
              </NavLink>
              <section
                id={"mega-panel-" + i}
                data-slot="mega-panel"
                aria-label={name + " menu"}
                inert={!expanded}
                aria-hidden={!expanded}
                data-expanded={expanded}
                onPointerEnter={intent.cancel}
              >
                <div
                  className="mega-columns"
                  style={{ "--columns": menu.columns.length } as CSSProperties}
                >
                  {menu.columns.map((column, j) => (
                    <div
                      className="mega-column"
                      key={column.title}
                      style={{ "--stagger": j } as CSSProperties}
                    >
                      <p className="mega-label">{column.title}</p>
                      {column.items.length ? (
                        column.items.map((item) => (
                          <MenuItem
                            key={item.label}
                            item={item}
                            close={close}
                          />
                        ))
                      ) : (
                        <p className="mega-empty">{column.empty}</p>
                      )}
                    </div>
                  ))}
                </div>
                <article data-slot="mega-feature">
                  <img className="mega-art" src={menu.feature.image} alt="" />
                  <div className="mega-feature-copy">
                    <span
                      className={menu.feature.live ? "badge" : "mega-label"}
                    >
                      {menu.feature.live ? "● " : ""}
                      {menu.feature.label}
                    </span>
                    <h2>{menu.feature.title}</h2>
                    <p>{menu.feature.body}</p>
                    {menu.feature.stats && (
                      <dl className="mega-stats">
                        {menu.feature.stats.map(([n, label]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{n}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <div className="mega-actions">
                      {menu.feature.links.map((item) => (
                        <MenuItem key={item.label} item={item} close={close} />
                      ))}
                      <Icon name="out" size={16} />
                    </div>
                  </div>
                </article>
              </section>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
