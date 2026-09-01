import { useEffect, useState } from "react";
import { LoaderCircle, Send, X } from "lucide-react";
import { useMentionAutocomplete } from "../../hooks/useMentionAutocomplete";
import { mentionToken } from "../../utils/mentions";
import MentionSuggestions from "./MentionSuggestions";

export default function CommentComposer({ inputId, onSubmit, replyTarget = null, onCancel, initialText = "" }) {
  const initialMention = replyTarget
    ? [{ id: replyTarget.userId, username: replyTarget.username }]
    : [];
  const mention = useMentionAutocomplete({
    initialText: initialText || (replyTarget ? `${mentionToken(replyTarget.username)} ` : ""),
    initialMentions: initialMention,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const suggestionsId = `${inputId}-mentions`;
  const trimmedText = mention.text.trim();
  const hasMessage = Boolean(trimmedText) && (
    !replyTarget || trimmedText !== mentionToken(replyTarget.username)
  );

  useEffect(() => {
    if (!replyTarget) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      mention.inputRef.current?.focus({ preventScroll: true });
      mention.inputRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [replyTarget?.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const text = trimmedText;
    if (!hasMessage) {
      setError(replyTarget ? "Add a message to your reply." : "Write a comment before sending.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        text,
        parentCommentId: replyTarget?.id || null,
        mentionUserIds: mention.selectedMentions.map((user) => user.id),
      });
      mention.reset();
      onCancel?.();
    } catch (requestError) {
      setError(requestError.message || "Your comment could not be added.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`comment-composer${replyTarget ? " comment-composer--reply" : ""}`}>
      {replyTarget ? (
        <div className="comment-composer__context">
          <span>Replying to <strong>@{replyTarget.username}</strong></span>
          <button type="button" onClick={onCancel} aria-label="Cancel reply"><X size={15} /></button>
        </div>
      ) : null}
      <form className="comment-thread__form" onSubmit={handleSubmit} aria-busy={submitting}>
        <label className="sr-only" htmlFor={inputId}>{replyTarget ? "Write a reply" : "Write a comment"}</label>
        <input
          ref={mention.inputRef}
          id={inputId}
          value={mention.text}
          onChange={(event) => {
            mention.handleChange(event);
            setError("");
          }}
          onFocus={mention.handleFocus}
          onKeyDown={mention.handleKeyDown}
          placeholder={initialText ? "Edit comment…" : (replyTarget ? "Write a reply…" : "Write a comment… Use @ to mention someone")}
          maxLength={400}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={mention.open}
          aria-controls={mention.open ? suggestionsId : undefined}
          aria-activedescendant={mention.open && mention.suggestions[mention.activeIndex]
            ? `${suggestionsId}-${mention.suggestions[mention.activeIndex].id}`
            : undefined}
        />
        <button className="comment-thread__send" type="submit" disabled={submitting || !hasMessage} aria-label={initialText ? "Save changes" : (replyTarget ? "Send reply" : "Send comment")}>
          {submitting ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        </button>
        {mention.open ? (
          <MentionSuggestions
            id={suggestionsId}
            suggestions={mention.suggestions}
            activeIndex={mention.activeIndex}
            loading={mention.loading}
            onSelect={mention.selectMention}
          />
        ) : null}
      </form>
      {error ? <p className="comment-thread__error" role="alert">{error}</p> : null}
    </div>
  );
}
