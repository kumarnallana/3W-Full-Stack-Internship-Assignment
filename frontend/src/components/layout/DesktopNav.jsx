import NotificationsDropdown from "./NotificationsDropdown";
import { House, LogOut, SquarePen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getUserDisplayName } from "../../utils/formatters";
import Avatar from "../ui/Avatar";
import BrandMark from "../ui/BrandMark";

export default function DesktopNav({ onCompose }) {
  const { user, logout } = useAuth();
  const displayName = getUserDisplayName(user);

  return (
    <aside className="desktop-nav">
      <BrandMark />

      <nav className="desktop-nav__links" aria-label="Primary navigation">
        <a className="desktop-nav__link desktop-nav__link--active" href="#feed-start" aria-current="page">
          <House size={20} aria-hidden="true" />
          Feed
        </a>
        <button className="desktop-nav__link" type="button" onClick={onCompose}>
          <SquarePen size={20} aria-hidden="true" />
          New post
        </button>
        <div className="desktop-nav__link-wrapper" style={{ padding: '0.75rem 1rem' }}>
          <NotificationsDropdown />
        </div>
      </nav>

      <div className="desktop-nav__account">
        <div className="desktop-nav__user">
          <Avatar name={displayName} src={user?.avatarUrl || user?.avatar} />
          <span>
            <strong>{displayName}</strong>
            <small>{user?.email || "Signed in"}</small>
          </span>
        </div>
        <button className="desktop-nav__logout" type="button" onClick={logout}>
          <LogOut size={18} aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  );
}

