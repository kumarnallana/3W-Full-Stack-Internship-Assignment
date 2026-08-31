import { CheckCircle2, MessageCircleHeart, PanelsTopLeft, WifiOff } from "lucide-react";
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
  const { apiMode } = useAuth();

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
          {apiMode === "explorer" ? (
            <div className="explorer-note" role="status">
              <WifiOff size={17} aria-hidden="true" />
              <span>
                <strong>Explorer mode is ready.</strong>
                The backend is offline, so test credentials will use a private local session.
              </span>
            </div>
          ) : null}
          {children}
        </div>
      </section>
    </main>
  );
}
