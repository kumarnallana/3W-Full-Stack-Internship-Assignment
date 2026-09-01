import { useState } from "react";
import { Heart, ImageOff, LoaderCircle, Maximize2, MessageCircle } from "lucide-react";
import { formatPostTime } from "../../utils/formatters";
import Avatar from "../ui/Avatar";
import CommentThread from "./CommentThread";
import ImageLightbox from "./ImageLightbox";

export default function PostCard({ post, onToggleLike, onAddComment }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [mediaFailed, setMediaFailed] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  async function handleLike() {
    if (likePending) return;
    setLikePending(true);
    setActionError("");
    try {
      await onToggleLike(post.id);
    } catch (error) {
      setActionError(error.message || "The like could not be updated.");
    } finally {
      setLikePending(false);
    }
  }

  return (
    <article className="post-card">
      <header className="post-card__header">
        <Avatar name={post.username} src={post.avatarUrl} />
        <div>
          <h2>{post.username}</h2>
          <time dateTime={post.createdAt}>{formatPostTime(post.createdAt)}</time>
        </div>
      </header>

      {post.text ? <p className="post-card__text">{post.text}</p> : null}

      {post.imageUrl ? (
        mediaFailed ? (
          <div className="post-card__media-fallback" role="img" aria-label="Image could not be loaded">
            <ImageOff size={24} aria-hidden="true" />
            <span>Image couldn't be loaded.</span>
          </div>
        ) : (
          <div className="post-card__media">
            <button
              className="post-card__media-button"
              type="button"
              onClick={() => setImageOpen(true)}
              aria-label={`View full-size image shared by ${post.username}`}
            >
              <img
                src={post.imageUrl}
                alt={`Post shared by ${post.username}`}
                loading="lazy"
                decoding="async"
                onError={() => setMediaFailed(true)}
              />
              <span className="post-card__media-expand" aria-hidden="true">
                <Maximize2 size={16} />
                View full image
              </span>
            </button>
          </div>
        )
      ) : null}

      {imageOpen ? (
        <ImageLightbox
          imageUrl={post.imageUrl}
          username={post.username}
          onClose={() => setImageOpen(false)}
        />
      ) : null}

      <div className="post-card__summary" aria-label={`${post.likeCount} likes and ${post.commentCount} comments`}>
        <span>{post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</span>
        <button type="button" onClick={() => setCommentsOpen((open) => !open)}>
          {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
        </button>
      </div>

      <div className="post-card__actions">
        <button
          type="button"
          className={post.viewerHasLiked ? "is-active" : ""}
          aria-pressed={post.viewerHasLiked}
          onClick={handleLike}
          disabled={likePending}
        >
          {likePending ? <LoaderCircle className="spin" size={19} /> : <Heart size={19} fill={post.viewerHasLiked ? "currentColor" : "none"} />}
          {post.viewerHasLiked ? "Liked" : "Like"}
        </button>
        <button type="button" onClick={() => setCommentsOpen((open) => !open)} aria-expanded={commentsOpen}>
          <MessageCircle size={19} aria-hidden="true" />
          Comment
        </button>
      </div>

      {actionError ? <p className="post-card__action-error" role="alert">{actionError}</p> : null}

      {commentsOpen ? (
        <CommentThread
          comments={post.comments}
          inputId={`comment-${post.id}`}
          onAddComment={(text) => onAddComment(post.id, text)}
        />
      ) : null}
    </article>
  );
}
