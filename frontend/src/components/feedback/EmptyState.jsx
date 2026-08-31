import { MessagesSquare } from "lucide-react";

export default function EmptyState({ onCreate }) {
  return (
    <section className="state-panel state-panel--empty">
      <span className="state-panel__icon" aria-hidden="true">
        <MessagesSquare size={24} />
      </span>
      <h2>No posts yet</h2>
      <p>Create the first post and start the conversation.</p>
      {onCreate ? (
        <button className="button button--primary" type="button" onClick={onCreate}>
          Create a post
        </button>
      ) : null}
    </section>
  );
}

