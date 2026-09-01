import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Send, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getUserDisplayName } from "../../utils/formatters";
import Avatar from "../ui/Avatar";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const PostComposer = forwardRef(function PostComposer({ onCreate }, ref) {
  const { user } = useAuth();
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useImperativeHandle(ref, () => ({
    focus() {
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => textareaRef.current?.focus(), 250);
    },
  }));

  useEffect(() => {
    if (!image) {
      setPreviewUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(image);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [image]);

  function handleImage(event) {
    const file = event.target.files?.[0];
    setError("");
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Keep the image under 5 MB.");
      event.target.value = "";
      return;
    }
    setImage(file);
  }

  function removeImage() {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const trimmedText = text.trim();
    if (!trimmedText && !image) {
      setError("Add some text or choose an image before posting.");
      textareaRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onCreate({ text: trimmedText, image });
      setText("");
      removeImage();
    } catch (requestError) {
      setError(requestError.message || "Your post could not be published. Your text is still here.");
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = getUserDisplayName(user);

  return (
    <section className="composer" aria-labelledby="composer-title">
      <div className="composer__identity">
        <Avatar name={displayName} src={user?.avatarUrl || user?.avatar} />
        <div>
          <h2 id="composer-title">Share something</h2>
          <p>Text, an image, or both.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} aria-busy={submitting}>
        <label className="sr-only" htmlFor="post-text">What's on your mind?</label>
        <textarea
          ref={textareaRef}
          id="post-text"
          value={text}
          maxLength={600}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          placeholder="What's on your mind?"
          rows={3}
        />

        {previewUrl ? (
          <div className="composer__preview">
            <img src={previewUrl} alt="Selected upload preview" />
            <button type="button" onClick={removeImage} aria-label="Remove selected image">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {error ? <p className="composer__error" role="alert">{error}</p> : null}

        <div className="composer__actions">
          <div>
            <input
              ref={fileInputRef}
              className="sr-only"
              id="post-image"
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleImage}
            />
            <label className="composer__media-button" htmlFor="post-image">
              <ImagePlus size={19} aria-hidden="true" />
              Add image
            </label>
            <span className="composer__counter">{text.length}/600</span>
          </div>
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting || (!text.trim() && !image)}
          >
            {submitting ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      </form>
    </section>
  );
});

export default PostComposer;
