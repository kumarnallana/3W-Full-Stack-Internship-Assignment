import NotificationsDropdown from "./NotificationsDropdown";
import { House, LogOut, SquarePen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function MobileNav({ onCompose }) {
  const { logout } = useAuth();

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <a href="#feed-start" className="mobile-nav__item mobile-nav__item--active" aria-current="page">
        <House size={20} aria-hidden="true" />
        <span>Feed</span>
      </a>
      <div className="mobile-nav__item" style={{ overflow: 'visible' }}>
        <NotificationsDropdown />
        <span>Alerts</span>
      </div>
      <button className="mobile-nav__compose" type="button" onClick={onCompose} aria-label="Create a post">
        <SquarePen size={22} aria-hidden="true" />
      </button>
      <button className="mobile-nav__item" type="button" onClick={logout}>
        <LogOut size={20} aria-hidden="true" />
        <span>Log out</span>
      </button>
    </nav>
  );
}

