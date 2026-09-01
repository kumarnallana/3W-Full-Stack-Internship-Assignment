import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordField from "../components/auth/PasswordField";
import { DEMO_ACCOUNT } from "../config/appMode";
import { useAuth } from "../context/AuthContext";
import { firstInvalidField, validateLogin } from "../validation/authValidation";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, apiMode } = useAuth();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [values, setValues] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function focusFirstError(nextErrors) {
    const field = firstInvalidField(nextErrors, ["email", "password"]);
    if (field === "email") emailRef.current?.focus();
    if (field === "password") passwordRef.current?.focus();
  }

  function validate() {
    const nextErrors = validateLogin(values);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) window.requestAnimationFrame(() => focusFirstError(nextErrors));
    return Object.keys(nextErrors).length === 0;
  }

  function validateField(field) {
    const nextError = validateLogin(values)[field] || "";
    setFieldErrors((current) => ({ ...current, [field]: nextError }));
  }

  function useDemoAccount() {
    setValues({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
    setFieldErrors({});
    setError("");
    passwordRef.current?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    setError("");

    try {
      await login({ email: values.email.trim(), password: values.password });
      navigate("/feed", { replace: true });
    } catch (requestError) {
      const serverErrors = requestError.details?.fieldErrors || {};
      if (Object.keys(serverErrors).length) {
        setFieldErrors(serverErrors);
        window.requestAnimationFrame(() => focusFirstError(serverErrors));
      }
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

        {apiMode === "demo" ? (
          <button className="demo-credentials" type="button" onClick={useDemoAccount}>
            Use the verified demo account
            <span>{DEMO_ACCOUNT.email}</span>
          </button>
        ) : null}

        <div className={`field${fieldErrors.email ? " field--error" : ""}`}>
          <label htmlFor="email">Email address</label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={updateField}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={254}
            onBlur={() => validateField("email")}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
            required
          />
          {fieldErrors.email ? (
            <p className="field__error" id="login-email-error">{fieldErrors.email}</p>
          ) : null}
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={values.password}
          onChange={updateField}
          error={fieldErrors.password}
          autoComplete="current-password"
          inputRef={passwordRef}
          minLength={1}
          onBlur={() => validateField("password")}
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
