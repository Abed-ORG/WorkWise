import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';
import { Input, Button } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

interface LoginForm { email: string; password: string; }
interface FormErrors { email?: string; password?: string; }

function validateForm(form: LoginForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address';
  if (!form.password) errors.password = 'Password is required';
  return errors;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const toast = useToast();
  const redirect = searchParams.get('redirect');
  const safeRedirect = redirect?.startsWith('/') ? redirect : '/dashboard';
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  function handleChange(field: keyof LoginForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await login({ email: form.email.trim(), password: form.password });
      toast.success('Welcome back!');
      navigate(safeRedirect, { replace: true });
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) setErrors({ password: 'Invalid email or password' });
      else toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <p className="auth-kicker">Welcome back</p>
      <h1 className="auth-title">Sign in to WorkWise</h1>
      <p className="auth-subtitle">New to WorkWise? <Link to={`/register?redirect=${encodeURIComponent(safeRedirect)}`}>Create an account</Link></p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input label="Work email" type="email" placeholder="you@company.com" value={form.email} onChange={(event) => handleChange('email', event.target.value)} error={errors.email} autoComplete="email" autoFocus />
        <Input label="Password" type="password" placeholder="Enter your password" value={form.password} onChange={(event) => handleChange('password', event.target.value)} error={errors.password} autoComplete="current-password" />
        <div className="auth-form-row"><Link to="/forgot-password" className="text-link text-xs">Forgot password?</Link></div>
        <Button type="submit" loading={loading} className="w-full">Sign in <Icon name="arrow-right" size={16} /></Button>
      </form>

      <div className="auth-note"><Icon name="sparkles" size={17} /> Your workspace, projects, and team updates stay organized in one place.</div>
    </AuthLayout>
  );
}
