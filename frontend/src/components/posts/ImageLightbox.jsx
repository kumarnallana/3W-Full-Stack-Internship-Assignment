import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function ImageLightbox({ imageUrl, username, onClose }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <h2 className="sr-only" id={titleId}>Image shared by {username}</h2>
      <button
        ref={closeButtonRef}
        className="image-lightbox__close"
        type="button"
        onClick={onClose}
        aria-label="Close full-screen image"
      >
        <X size={22} aria-hidden="true" />
      </button>
      <figure className="image-lightbox__content">
        <img src={imageUrl} alt={`Full-size post shared by ${username}`} />
        <figcaption>Shared by {username}</figcaption>
      </figure>
    </div>,
    document.body,
  );
}
