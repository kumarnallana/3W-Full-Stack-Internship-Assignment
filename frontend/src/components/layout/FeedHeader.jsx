import { SquarePen } from "lucide-react";
import BrandMark from "../ui/BrandMark";

export default function FeedHeader({ onCompose }) {
  return (
    <header className="feed-header" id="feed-start">
      <div className="feed-header__mobile-brand">
        <BrandMark compact />
      </div>
      <div>
        <p className="eyebrow">Community</p>
        <h1>Latest conversations</h1>
        <p>Thoughts and moments shared by everyone.</p>
      </div>
      <button className="button button--primary feed-header__action" type="button" onClick={onCompose}>
        <SquarePen size={18} aria-hidden="true" />
        New post
      </button>
    </header>
  );
}

