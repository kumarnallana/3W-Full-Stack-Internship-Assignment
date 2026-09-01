import { useMemo, useState } from "react";
import CommentComposer from "../comments/CommentComposer";
import CommentItem from "../comments/CommentItem";

export default function CommentThread({ comments, onAddComment, inputId }) {
  const [replyTarget, setReplyTarget] = useState(null);
  const { roots, repliesByRoot } = useMemo(() => {
    const ids = new Set(comments.map((comment) => comment.id));
    const rootComments = comments.filter((comment) => !comment.parentCommentId || !ids.has(comment.parentCommentId));
    const grouped = new Map();
    comments.forEach((comment) => {
      if (!comment.parentCommentId || !ids.has(comment.parentCommentId)) return;
      const current = grouped.get(comment.parentCommentId) || [];
      current.push(comment);
      grouped.set(comment.parentCommentId, current);
    });
    return { roots: rootComments, repliesByRoot: grouped };
  }, [comments]);

  function renderComment(comment, isReply = false) {
    return (
      <div className="comment-thread__item" key={comment.id}>
        <CommentItem comment={comment} isReply={isReply} onReply={setReplyTarget} />
        {replyTarget?.id === comment.id ? (
          <CommentComposer
            key={`reply-${comment.id}`}
            inputId={`${inputId}-reply-${comment.id}`}
            replyTarget={comment}
            onSubmit={onAddComment}
            onCancel={() => setReplyTarget(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="comment-thread">
      <div
        className="comment-thread__list"
        role="log"
        aria-label="Comments and replies"
        aria-live="polite"
        aria-relevant="additions"
      >
        {comments.length ? (
          roots.map((comment) => (
            <div className="comment-thread__conversation" key={comment.id}>
              {renderComment(comment)}
              {(repliesByRoot.get(comment.id) || []).map((reply) => renderComment(reply, true))}
            </div>
          ))
        ) : (
          <p className="comment-thread__empty">No comments yet. Start the conversation.</p>
        )}
      </div>

      <CommentComposer inputId={inputId} onSubmit={onAddComment} />
    </div>
  );
}
