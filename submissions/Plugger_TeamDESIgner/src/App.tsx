import { MegaNav } from "./components/nav/MegaNav";
import { useCallback, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Home, Pulse, Clubs, Club, NotFound } from "./Discover";
import Hub from "./Hub";
import { ProfilePage, CalendarPage, OrganizerPage } from "./Manage";
import { useApp } from "./store";
import { seed } from "./seed";
import { Dialog, Icon, Segments } from "./ui";
const routes = [
  ["Discover", "/", "discover"],
  ["Pulse", "/pulse", "pulse"],
  ["Clubs", "/clubs", "users"],
  ["Calendar", "/calendar", "calendar"],
  ["Organizer", "/organizer", "controls"],
  ["Profile", "/profile", "profile"],
];
export default function App() {
  const { s, u, change, toast } = useApp();
  const [panel, setPanel] = useState("");
  const openDemo = useCallback(() => setPanel("Demo controls"), []);
  const loc = useLocation(),
    go = useNavigate();
  const notes = s.notifications
    .filter((n) => n.userId === u.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notes.filter((n) => !n.read).length;
  useEffect(() => {
    setPanel("");
    document.title =
      (routes.find((r) => r[1] === loc.pathname)?.[0] ||
        s.events.find((e) => "/events/" + e.id === loc.pathname)?.title ||
        s.clubs.find((c) => "/clubs/" + c.id === loc.pathname)?.name ||
        "Page") + " · Plugged";
    document.getElementById("main")?.focus({ preventScroll: true });
    const anchor = document.getElementById(loc.hash.slice(1));
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [loc.pathname, loc.hash]);
  const theme = () =>
    change((d) => {
      d.themePref = d.themePref === "dark" ? "light" : "dark";
    });
  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header data-component="app-header">
        <div className="wrap header-inner">
          <Link to="/" aria-label="Plugged home" className="wordmark">
            <img
              src="/assets/brand/favicon.svg"
              width="32"
              height="32"
              alt=""
            />
            PLUGGED
          </Link>
          <MegaNav onDemo={openDemo} />
          <div className="tools">
            <button
              className="circle"
              aria-label={"Notifications, " + unread + " unread"}
              onClick={() => setPanel("Notifications")}
            >
              <Icon name="bell" />
              {unread > 0 && <span data-component="badge" data-tone="count" className="notification-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
            </button>
            <button
              className="circle"
              aria-label="Toggle theme"
              onClick={theme}
            >
              <Icon name={s.themePref === "dark" ? "sun" : "moon"} />
            </button>
            <button
              className="controls"
              aria-label="Demo controls"
              onClick={() => setPanel("Demo controls")}
            >
              <Icon name="controls" />
              <span>Demo controls</span>
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pulse" element={<Pulse />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/clubs/:id" element={<Club />} />
          <Route path="/events/:id" element={<Hub key={loc.pathname} />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/organizer" element={<OrganizerPage />} />
          <Route path="/profile" element={<ProfilePage key={u.id} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="wrap site-footer">
        <Link to="/" className="wordmark">
          <img src="/assets/brand/favicon.svg" width="24" height="24" alt="" />
          PLUGGED
        </Link>
        <span>Ramaiah Institute of Technology · Bengaluru</span>
      </footer>
      <nav
        className="mobile-nav"
        data-component="navigation"
        data-variant="mobile"
        aria-label="Mobile navigation"
      >
        {routes
          .filter(([name]) => name !== "Organizer")
          .map(([name, path, icon]) => (
            <NavLink key={name} end={path === "/"} to={path}>
              <Icon name={icon} />
              <span>{name}</span>
            </NavLink>
          ))}
      </nav>
      {panel && (
        <Dialog title={panel} onClose={() => setPanel("")}>
          {panel === "Demo controls" ? (
            <div className="stack">
              <p>
                Explore campus as a student or manage events as an organizer.
              </p>
              <Segments
                items={["Student", "Organizer"]}
                value={s.activeRole === "student" ? "Student" : "Organizer"}
                select={(x) =>
                  change((d) => {
                    d.activeRole = x === "Student" ? "student" : "organizer";
                  })
                }
              />
              <label>
                Active demo user
                <select
                  value={u.id}
                  onChange={(e) =>
                    change((d) => {
                      d.currentUserId = e.target.value;
                    })
                  }
                >
                  {s.users.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={theme}>
                Switch to {s.themePref === "dark" ? "light" : "dark"} theme
              </button>
              {s.activeRole === "organizer" && (
                <button
                  onClick={() => {
                    go("/organizer");
                    setPanel("");
                  }}
                >
                  Open organizer
                </button>
              )}
              <button onClick={() => setPanel("Reset demo data?")}>
                Reset demo data
              </button>
            </div>
          ) : panel === "Reset demo data?" ? (
            <div className="stack">
              <p>
                This removes your local edits and restores the original campus
                events and RSVPs.
              </p>
              <button
                onClick={() => {
                  change((d) => Object.assign(d, seed()));
                  setPanel("");
                  go("/");
                  toast("Demo data restored");
                }}
              >
                Reset demo data
              </button>
              <button onClick={() => setPanel("Demo controls")}>Cancel</button>
            </div>
          ) : (
            <div className="stack">
              <button
                disabled={!unread}
                onClick={() =>
                  change((d) =>
                    d.notifications
                      .filter((n) => n.userId === u.id)
                      .forEach((n) => (n.read = true)),
                  )
                }
              >
                Mark all read
              </button>
              {notes.length === 0 && <p>Your inbox is empty.</p>}
              {notes.map((n) => (
                <button
                  className="note"
                  key={n.id}
                  onClick={() => {
                    change((d) => {
                      d.notifications.find((x) => x.id === n.id)!.read = true;
                    });
                    if (n.eventId) {
                      setPanel("");
                      go("/events/" + n.eventId);
                    }
                  }}
                >
                  <strong>
                    {n.read ? "" : "● "}
                    {n.title}
                  </strong>
                  <span>{n.message}</span>
                </button>
              ))}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
