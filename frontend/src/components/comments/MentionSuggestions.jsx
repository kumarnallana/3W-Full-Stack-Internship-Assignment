import { useEffect, useRef } from "react";
import Avatar from "../ui/Avatar";

export default function MentionSuggestions({ id, suggestions, activeIndex, loading, onSelect }) {
  const activeOptionRef = useRef(null);

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div className="mention-suggestions" id={id} role="listbox" aria-label="People you can mention">
      {loading ? <p className="mention-suggestions__status">Finding people…</p> : null}
      {!loading && !suggestions.length ? (
        <p className="mention-suggestions__status">No matching people.</p>
      ) : null}
      {suggestions.map((user, index) => (
        <button
          className={index === activeIndex ? "is-active" : ""}
          id={`${id}-${user.id}`}
          key={user.id}
          ref={index === activeIndex ? activeOptionRef : null}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onSelect(user)}
        >
          <Avatar name={user.username} size="small" />
          <span>{user.username}</span>
          <small>@{user.username.replace(/\s+/g, "_")}</small>
        </button>
      ))}
    </div>
  );
}
