import { MessageCircleMore, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getUserDisplayName } from "../../utils/formatters";
import Avatar from "../ui/Avatar";
import DesktopNav from "./DesktopNav";
import MobileNav from "./MobileNav";

export default function AppShell({ children, onCompose }) {
  const { user } = useAuth();
  const displayName = getUserDisplayName(user);

  return (
    <div className="app-shell">
      <DesktopNav onCompose={onCompose} />
      <main className="app-shell__main">{children}</main>

      <aside className="context-rail" aria-label="Your community context">
        <section className="context-card context-card--profile">
          <Avatar name={displayName} src={user?.avatarUrl || user?.avatar} size="large" />
          <div>
            <p className="eyebrow">Signed in as</p>
            <h2>{displayName}</h2>
            <p>{user?.email || "Ready to join the conversation"}</p>
          </div>
        </section>

        <section className="context-card">
          <span className="context-card__icon" aria-hidden="true">
            <MessageCircleMore size={20} />
          </span>
          <h2>One shared feed</h2>
          <p>Every post is public to signed-in community members.</p>
        </section>

        <section className="context-card context-card--quiet">
          <ShieldCheck size={19} aria-hidden="true" />
          <p>Share thoughtfully. Your name appears with every interaction.</p>
        </section>
      </aside>

      <MobileNav onCompose={onCompose} />
    </div>
  );
}

