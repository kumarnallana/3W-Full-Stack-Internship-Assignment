import { SquarePen } from "lucide-react";
import BrandMark from "../ui/BrandMark";

export default function FeedHeader({ onCompose }) {
  return (
    <header className="feed-header">
      <div className="feed-header__mobile-brand" aria-hidden="true">
        <BrandMark compact />
      </div>

      <div className="feed-header__copy">
        <p className="eyebrow" style={{ marginBottom: '4px' }}>THE COMMUNITY FEED</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.4rem', margin: 0, letterSpacing: '-0.02em' }}>Fresh from the feed</h1>
          <button
            className="button button--primary feed-header__action"
            type="button"
            onClick={onCompose}
          >
            <SquarePen size={16} aria-hidden="true" />
            New post
          </button>
        </div>
        <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>See what's happening right now.</p>
      </div>
    </header>
  );
}
