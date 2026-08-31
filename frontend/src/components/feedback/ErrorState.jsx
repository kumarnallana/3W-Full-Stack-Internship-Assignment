import { RefreshCw } from "lucide-react";

export default function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}) {
  return (
    <section className="state-panel state-panel--error" role="alert">
      <span className="state-panel__icon" aria-hidden="true">
        !
      </span>
      <h2>{title}</h2>
      <p>{message || "We could not complete that request."}</p>
      {onRetry ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw size={17} aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </section>
  );
}

