export default function FeedSkeleton({ count = 3 }) {
  return (
    <div className="feed-skeleton" aria-label="Loading posts" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="post-card post-card--skeleton" key={index}>
          <div className="skeleton-row">
            <span className="skeleton skeleton--avatar" />
            <span className="skeleton skeleton--line skeleton--line-short" />
          </div>
          <span className="skeleton skeleton--line" />
          <span className="skeleton skeleton--line skeleton--line-medium" />
          <span className="skeleton skeleton--media" />
        </article>
      ))}
    </div>
  );
}

