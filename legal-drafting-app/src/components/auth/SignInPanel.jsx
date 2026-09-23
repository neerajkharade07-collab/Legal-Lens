import { useRef, useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { MAIN_SITE_SIGNUP_URL } from '../../services/siteConfig';
import { getMainSiteHints } from '../../services/mainSiteSession';
import './SignInPanel.css';

/**
 * Sign-in for the Legal Drafting app, using the existing Legal Lens accounts
 * (customer or lawyer). Accounts are created on the main Legal Lens site.
 */
export function SignInPanel() {
  const { signIn } = useAuth();
  const [hints] = useState(getMainSiteHints);
  const [role, setRole] = useState(hints.role);
  const [email, setEmail] = useState(hints.email);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn({ email: email.trim(), password, role });
    } catch (err) {
      setError(err?.message || 'Sign-in failed. Please try again.');
      setSubmitting(false);
      emailRef.current?.focus();
    }
  }

  return (
    <div className="signin container">
      <form className="signin__card" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">Legal Drafting Assistant</p>
        <h1 className="signin__title">Sign in to your drafts</h1>
        <p className="signin__lead">
          Use your Legal Lens account. Your documents and version history are saved to your account.
        </p>

        <div className="signin__roles" role="radiogroup" aria-label="Account type">
          {[
            ['customer', 'Client'],
            ['lawyer', 'Lawyer'],
          ].map(([id, label]) => (
            <label key={id} className={role === id ? 'is-active' : undefined}>
              <input
                type="radio"
                name="signin-role"
                value={id}
                checked={role === id}
                onChange={() => setRole(id)}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="signin-email">
            Email
          </label>
          <input
            ref={emailRef}
            id="signin-email"
            type="email"
            className="form-input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="signin-password">
            Password
          </label>
          <input
            id="signin-password"
            type="password"
            className="form-input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="form-error signin__error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" icon={LogIn} fullWidth disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>

        <p className="signin__foot">
          No account yet? <a href={MAIN_SITE_SIGNUP_URL}>Create one on Legal Lens</a>
        </p>
      </form>
    </div>
  );
}
