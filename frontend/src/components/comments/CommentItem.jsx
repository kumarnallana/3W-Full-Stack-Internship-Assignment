import { useState } from "react";
import { Reply, Heart, Pencil, Trash2 } from "lucide-react";
import { formatPostTime } from "../../utils/formatters";
import Avatar from "../ui/Avatar";
import MentionText from "./MentionText";
import { useAuth } from "../../context/AuthContext";
import CommentComposer from "./CommentComposer";

export default function CommentItem({ 
  comment, 
  isReply = false, 
  onReply, 
  onEdit, 
  onDelete, 
  onToggleLike 
}) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const isOwner = user?.id === comment.userId;

  async function handleEditSubmit(data) {
    if (onEdit) {
      await onEdit(data);
      setIsEditing(false);
    }
  }

  if (isEditing) {
    return (
      <div className={`comment${isReply ? " comment--reply" : ""}`}>
        <Avatar name={comment.username} src={comment.avatarUrl} size="small" />
        <div style={{ flex: 1 }}>
          <CommentComposer 
            inputId={`edit-comment-${comment.id}`}
            initialText={comment.text}
            onSubmit={handleEditSubmit}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <article className={`comment${isReply ? " comment--reply" : ""}`}>
      <Avatar name={comment.username} src={comment.avatarUrl} size="small" />
      <div className="comment__content">
        <div className="comment__body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{comment.username}</strong>
              <time dateTime={comment.createdAt}>{formatPostTime(comment.createdAt)}</time>
              {comment.isEdited && <span className="comment__edited-badge" style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)', marginLeft: '6px' }}>(edited)</span>}
            </div>
            {isOwner && (
              <div className="comment__owner-actions" style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setIsEditing(true)} aria-label="Edit comment" style={{ background: 'none', border: 'none', color: 'var(--color-text-subtle)', cursor: 'pointer', padding: '2px' }}>
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={onDelete} aria-label="Delete comment" style={{ background: 'none', border: 'none', color: 'var(--color-text-subtle)', cursor: 'pointer', padding: '2px' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
          {comment.replyToUsername ? (
            <span className="comment__reply-context">Replying to @{comment.replyToUsername}</span>
          ) : null}
          <p><MentionText text={comment.text} mentions={comment.mentions} /></p>
        </div>
        
        <div className="comment__actions" style={{ display: 'flex', gap: '16px', marginTop: '6px', alignItems: 'center' }}>
          <button className="comment__reply-action" type="button" onClick={() => onReply(comment)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--color-text-subtle)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
            <Reply size={14} aria-hidden="true" /> Reply
          </button>
          
          <button 
            type="button" 
            onClick={onToggleLike}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              background: 'none', 
              border: 'none', 
              color: comment.viewerHasLiked ? 'var(--color-primary)' : 'var(--color-text-subtle)', 
              fontSize: '0.75rem', 
              cursor: 'pointer',
              padding: 0 
            }}
          >
            <Heart size={14} fill={comment.viewerHasLiked ? "currentColor" : "none"} /> 
            {comment.likeCount > 0 ? comment.likeCount : ""}
          </button>
        </div>
      </div>
    </article>
  );
}
