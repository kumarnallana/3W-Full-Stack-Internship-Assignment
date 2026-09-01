import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordField from "../components/auth/PasswordField";
import { useAuth } from "../context/AuthContext";
import { AUTH_RULES, firstInvalidField, validateSignup } from "../validation/authValidation";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const fieldRefs = {
    username: useRef(null),
    email: useRef(null),
    password: useRef(null),
    confirmPassword: useRef(null),
  };
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setRequestError("");
  }

  function focusFirstError(nextErrors) {
    const field = firstInvalidField(nextErrors, ["username", "email", "password", "confirmPassword"]);
    fieldRefs[field]?.current?.focus();
  }

  function validate() {
    const nextErrors = validateSignup(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) window.requestAnimationFrame(() => focusFirstError(nextErrors));
    return Object.keys(nextErrors).length === 0;
  }

  function validateField(field) {
    const nextError = validateSignup(values)[field] || "";
    setErrors((current) => ({ ...current, [field]: nextError }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setRequestError("");
    try {
      const user = await signup({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      navigate(user ? "/feed" : "/login", { replace: true });
    } catch (error) {
      const serverErrors = error.details?.fieldErrors || {};
      if (Object.keys(serverErrors).length) {
        setErrors(serverErrors);
        window.requestAnimationFrame(() => focusFirstError(serverErrors));
      }
      setRequestError(error.message || "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Join Mini Social"
      title="Create your community profile"
      description="A username, email, and password are all you need to begin."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {requestError ? <div className="form-alert" role="alert">{requestError}</div> : null}

        <div className={`field${errors.username ? " field--error" : ""}`}>
          <label htmlFor="username">Username</label>
          <input
            ref={fieldRefs.username}
            id="username"
            name="username"
            value={values.username}
            onChange={updateField}
            placeholder="How others will know you"
            autoComplete="username"
            minLength={AUTH_RULES.usernameMin}
            maxLength={AUTH_RULES.usernameMax}
            onBlur={() => validateField("username")}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={errors.username ? "username-error" : undefined}
            required
          />
          {errors.username ? <p className="field__error" id="username-error">{errors.username}</p> : null}
        </div>

        <div className={`field${errors.email ? " field--error" : ""}`}>
          <label htmlFor="email">Email address</label>
          <input
            ref={fieldRefs.email}
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={updateField}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={254}
            onBlur={() => validateField("email")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            required
          />
          {errors.email ? <p className="field__error" id="email-error">{errors.email}</p> : null}
        </div>

        <div className="auth-form__password-grid">
          <PasswordField
            id="password"
            label="Password"
            value={values.password}
            onChange={updateField}
            error={errors.password}
            autoComplete="new-password"
            inputRef={fieldRefs.password}
            helper="6+ characters"
            onBlur={() => validateField("password")}
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            value={values.confirmPassword}
            onChange={updateField}
            error={errors.confirmPassword}
            autoComplete="new-password"
            inputRef={fieldRefs.confirmPassword}
            onBlur={() => validateField("confirmPassword")}
          />
        </div>

        <button className="button button--primary button--wide" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
          {!submitting ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </button>
      </form>

      <p className="auth-card__switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
