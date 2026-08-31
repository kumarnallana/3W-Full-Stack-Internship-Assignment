import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { formatPostTime } from "../../utils/formatters";
import Avatar from "../ui/Avatar";

export default function CommentThread({ comments, onAddComment, inputId }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Write a comment before sending.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onAddComment(trimmed);
      setText("");
    } catch (requestError) {
      setError(requestError.message || "Your comment could not be added.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="comment-thread">
      <div className="comment-thread__list">
        {comments.length ? (
          comments.map((comment) => (
            <div className="comment" key={comment.id}>
              <Avatar name={comment.username} src={comment.avatarUrl} size="small" />
              <div className="comment__body">
                <div>
                  <strong>{comment.username}</strong>
                  <time dateTime={comment.createdAt}>{formatPostTime(comment.createdAt)}</time>
                </div>
                <p>{comment.text}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="comment-thread__empty">No comments yet. Start the conversation.</p>
        )}
      </div>

      <form className="comment-thread__form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={inputId}>Write a comment</label>
        <input
          id={inputId}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          placeholder="Write a comment…"
          maxLength={400}
        />
        <button type="submit" disabled={submitting || !text.trim()} aria-label="Send comment">
          {submitting ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        </button>
      </form>
      {error ? <p className="comment-thread__error" role="alert">{error}</p> : null}
    </div>
  );
}
