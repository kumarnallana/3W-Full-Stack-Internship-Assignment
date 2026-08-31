import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordField from "../components/auth/PasswordField";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [values, setValues] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login({ email: values.email.trim(), password: values.password });
      navigate("/feed", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Continue the conversation"
      description="Log in with the account you created for Mini Social."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error ? <div className="form-alert" role="alert">{error}</div> : null}

        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={updateField}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={values.password}
          onChange={updateField}
          autoComplete="current-password"
        />

        <button className="button button--primary button--wide" type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
          {!submitting ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </button>
      </form>

      <p className="auth-card__switch">
        New to Mini Social? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

