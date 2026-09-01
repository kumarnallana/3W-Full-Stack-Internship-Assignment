import { Reply } from "lucide-react";
import { formatPostTime } from "../../utils/formatters";
import Avatar from "../ui/Avatar";
import MentionText from "./MentionText";

export default function CommentItem({ comment, isReply = false, onReply }) {
  return (
    <article className={`comment${isReply ? " comment--reply" : ""}`}>
      <Avatar name={comment.username} src={comment.avatarUrl} size="small" />
      <div className="comment__content">
        <div className="comment__body">
          <div>
            <strong>{comment.username}</strong>
            <time dateTime={comment.createdAt}>{formatPostTime(comment.createdAt)}</time>
          </div>
          {comment.replyToUsername ? (
            <span className="comment__reply-context">Replying to @{comment.replyToUsername}</span>
          ) : null}
          <p><MentionText text={comment.text} mentions={comment.mentions} /></p>
        </div>
        <button className="comment__reply-action" type="button" onClick={() => onReply(comment)}>
          <Reply size={14} aria-hidden="true" /> Reply
        </button>
      </div>
    </article>
  );
}
