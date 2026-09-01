import { CheckCircle2, FlaskConical, MessageCircleHeart, PanelsTopLeft, RotateCw, ServerOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandMark from "../ui/BrandMark";

const productPoints = [
  {
    icon: MessageCircleHeart,
    title: "Share without friction",
    text: "Post a thought, a photo, or both in a few clear steps.",
  },
  {
    icon: PanelsTopLeft,
    title: "Designed for every screen",
    text: "A focused feed on mobile and a complete application shell on desktop.",
  },
  {
    icon: CheckCircle2,
    title: "Simple by intention",
    text: "Only the interactions this community needs—nothing ornamental.",
  },
];

export default function AuthLayout({ eyebrow, title, description, children }) {
  const { apiMode, sessionError, retrySession } = useAuth();

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="About Mini Social">
        <BrandMark />
        <div className="auth-story__message">
          <p className="eyebrow">A small space for real updates</p>
          <h1>Good conversations start with something worth sharing.</h1>
          <p>
            Mini Social keeps the familiar feed experience while making every
            interaction feel considered, calm, and responsive.
          </p>
        </div>
        <div className="auth-story__points">
          {productPoints.map(({ icon: Icon, title: pointTitle, text }) => (
            <div className="auth-story__point" key={pointTitle}>
              <span aria-hidden="true">
                <Icon size={19} />
              </span>
              <div>
                <strong>{pointTitle}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="auth-story__footer">3W full-stack internship assessment</p>
      </section>

      <section className="auth-panel">
        <div className="auth-panel__mobile-brand">
          <BrandMark />
        </div>
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="auth-card__description">{description}</p>
          {apiMode === "demo" ? (
            <div className="environment-note" role="status">
              <FlaskConical size={17} aria-hidden="true" />
              <span>
                <strong>Demo environment</strong>
                Demo accounts and posts stay in this browser. This mode never activates automatically.
              </span>
            </div>
          ) : null}
          {sessionError ? (
            <div className="environment-note environment-note--error" role="alert">
              <ServerOff size={17} aria-hidden="true" />
              <span>
                <strong>API connection unavailable</strong>
                {sessionError}
                <button type="button" onClick={retrySession}>
                  <RotateCw size={14} aria-hidden="true" /> Retry connection
                </button>
              </span>
            </div>
          ) : null}
          {children}
        </div>
      </section>
    </main>
  );
}
