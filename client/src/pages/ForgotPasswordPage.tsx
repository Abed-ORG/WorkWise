import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';
import { Button, Input } from '../components/ui';
import { requestPasswordReset } from '../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await requestPasswordReset(normalizedEmail);
      setSent(true);
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        if (requestError.response?.status === 429) {
          setError('Too many reset requests. Please wait a bit before trying again.');
        } else if (requestError.response?.status === 503) {
          setError('Email delivery is not configured yet. Please contact your administrator.');
        } else {
          setError('We could not send the reset email. Please try again.');
        }
      } else {
        setError('We could not send the reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <p className="auth-kicker">Account recovery</p>
      <h1 className="auth-title">Reset your password</h1>
      <p className="auth-subtitle">Remembered it? <Link to="/login">Return to sign in</Link></p>

      {sent ? (
        <>
          <div className="auth-note alert-success">
            <Icon name="check" size={18} />
            If a WorkWise account uses that email, a secure reset link is on its way. Check your inbox and spam folder.
          </div>
          <Link to="/login" className="btn btn-primary w-full auth-action-link">Back to sign in</Link>
        </>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Work email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => { setEmail(event.target.value); setError(''); }}
            error={error}
            autoComplete="email"
            autoFocus
          />
          <Button type="submit" loading={loading} className="w-full">
            Send reset link <Icon name="arrow-right" size={16} />
          </Button>
        </form>
      )}

      <div className="auth-note"><Icon name="sparkles" size={17} /> Reset links expire after one hour and can only be used once.</div>
    </AuthLayout>
  );
}
