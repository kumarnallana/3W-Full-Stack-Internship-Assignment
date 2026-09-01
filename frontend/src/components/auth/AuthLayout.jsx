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
        <div className="auth-story__message" style={{ marginTop: '2rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: '1.1', marginBottom: '1rem', letterSpacing: '-0.04em' }}>Good conversations<br/>start small.</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', maxWidth: '400px' }}>
            Share an idea. Get a response. Keep the conversation moving.
          </p>
        </div>
        
        <div className="auth-story__preview" style={{ marginTop: '3rem', maxWidth: '420px' }}>
          <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-support)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.7rem', color: '#000' }}>S</div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem' }}><strong>Sasi Kumar</strong> <span style={{ color: 'var(--color-text-subtle)' }}>2m</span></p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>We just shipped the new design system. Let me know what you think about the spacing!</p>
                
                <div style={{ marginTop: '1rem', display: 'flex', gap: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.6rem', color: '#000' }}>A</div>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem' }}><strong>Akash</strong> <span style={{ color: 'var(--color-text-subtle)' }}>1m</span></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)' }}>The new typography scale looks incredibly crisp on mobile.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <p className="auth-story__footer" style={{ marginTop: 'auto', paddingTop: '2rem' }}>3W full-stack internship assessment</p>
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
