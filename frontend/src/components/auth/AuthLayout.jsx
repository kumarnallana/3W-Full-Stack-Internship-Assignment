import { FlaskConical, RotateCw, ServerOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandMark from "../ui/BrandMark";

export default function AuthLayout({ eyebrow, title, description, children }) {
  const { apiMode, sessionError, retrySession } = useAuth();

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="About Mini Social">
        <BrandMark />
        <div className="auth-story__message">
          <h1>Good conversations<br/>start small.</h1>
          <p>
            Share an idea. Get a response. Keep the conversation moving.
          </p>
        </div>
        
        <div className="auth-story__preview">
          <div className="auth-story__preview-card">
            <div className="auth-story__preview-header">
              <div className="auth-story__preview-avatar">S</div>
              <div className="auth-story__preview-content">
                <p><strong>Sasi Kumar</strong> <span>2m</span></p>
                <p>We just shipped the new design system. Let me know what you think about the spacing!</p>
                
                <div className="auth-story__preview-reply">
                  <div className="auth-story__preview-avatar auth-story__preview-avatar--reply">A</div>
                  <div className="auth-story__preview-content">
                    <p><strong>Akash</strong> <span>1m</span></p>
                    <p>The new typography scale looks incredibly crisp on mobile.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
