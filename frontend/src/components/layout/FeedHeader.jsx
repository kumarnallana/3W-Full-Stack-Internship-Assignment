import { FlaskConical, SquarePen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandMark from "../ui/BrandMark";

export default function FeedHeader({ onCompose }) {
  const { apiMode } = useAuth();

  return (
    <header className="feed-header" id="feed-start">
      <div className="feed-header__mobile-brand">
        <BrandMark compact />
      </div>
      <div className="feed-header__copy">
        <p className="eyebrow">The community signal</p>
        <h1>Fresh from the feed</h1>
        <p>Small updates, useful ideas, and moments worth sharing.</p>
      </div>
      <div className="feed-header__controls">
        {apiMode === "demo" ? (
          <span className="mode-badge" title="This explicitly configured environment stores demo data in this browser.">
            <FlaskConical size={14} aria-hidden="true" />
            Demo
          </span>
        ) : null}
        <button className="button button--primary feed-header__action" type="button" onClick={onCompose}>
          <SquarePen size={18} aria-hidden="true" />
          <span>New post</span>
        </button>
      </div>
    </header>
  );
}
