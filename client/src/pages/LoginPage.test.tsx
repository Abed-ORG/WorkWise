import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';

const login = vi.fn();
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ login }) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('../components/ThemeToggle', () => ({ default: () => <button type="button">Toggle theme</button> }));

describe('LoginPage', () => {
  it('renders the login form and validates required fields', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Sign in to WorkWise' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });
});
