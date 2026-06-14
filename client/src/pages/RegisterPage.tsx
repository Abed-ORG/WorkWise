import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';
import { Input, Button } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

interface RegisterForm { name: string; email: string; password: string; confirmPassword: string; }
interface FormErrors { name?: string; email?: string; password?: string; confirmPassword?: string; }

function validateForm(form: RegisterForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address';
  if (!form.password) errors.password = 'Password is required';
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters';
  if (!form.confirmPassword) errors.confirmPassword = 'Please confirm your password';
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<RegisterForm>({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  function handleChange(field: keyof RegisterForm, value: string) {
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
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success('Account created successfully. You can now sign in.');
      navigate('/login', { replace: true });
    } catch (error: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined;
      if (message?.toLowerCase().includes('email') || message?.toLowerCase().includes('exists')) {
        setErrors({ email: 'An account with this email already exists' });
      }
      else toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout compact>
      <p className="auth-kicker">Start building clearly</p>
      <h1 className="auth-title">Create your workspace</h1>
      <p className="auth-subtitle">Already have an account? <Link to="/login">Sign in</Link></p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input label="Full name" placeholder="Your full name" value={form.name} onChange={(event) => handleChange('name', event.target.value)} error={errors.name} autoComplete="name" autoFocus />
        <Input label="Work email" type="email" placeholder="you@company.com" value={form.email} onChange={(event) => handleChange('email', event.target.value)} error={errors.email} autoComplete="email" />
        <Input label="Password" type="password" placeholder="At least 8 characters" value={form.password} onChange={(event) => handleChange('password', event.target.value)} error={errors.password} autoComplete="new-password" />
        <Input label="Confirm password" type="password" placeholder="Repeat your password" value={form.confirmPassword} onChange={(event) => handleChange('confirmPassword', event.target.value)} error={errors.confirmPassword} autoComplete="new-password" />
        <Button type="submit" loading={loading} className="w-full mt-1">Create account <Icon name="arrow-right" size={16} /></Button>
      </form>
    </AuthLayout>
  );
}
