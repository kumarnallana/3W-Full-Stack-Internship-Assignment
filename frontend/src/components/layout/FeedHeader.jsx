import { SquarePen } from "lucide-react";
import BrandMark from "../ui/BrandMark";

export default function FeedHeader({ onCompose }) {
  return (
    <header className="feed-header">
      <div className="feed-header__mobile-brand" aria-hidden="true">
        <BrandMark compact />
      </div>

      <div className="feed-header__copy">
        <h1 style={{ fontSize: '1.4rem', margin: 0, letterSpacing: '-0.02em' }}>Community</h1>
        <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>See what everyone is sharing.</p>
      </div>

      <div className="feed-header__controls">
        <button
          className="button button--primary feed-header__action"
          type="button"
          onClick={onCompose}
        >
          <SquarePen size={16} aria-hidden="true" />
          New post
        </button>
      </div>
    </header>
  );
}
