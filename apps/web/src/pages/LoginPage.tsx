import { useState, type FormEvent } from 'react';
import { ThemeToggle } from '@atlas/ui';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error?.message ?? 'Erro ao fazer login');
        return;
      }

      if (body.data?.requires2FA) {
        // TODO: redirect pra /2fa com tempToken (US3)
        setError('2FA necessário — funcionalidade em implementação');
        return;
      }

      window.location.href = '/';
    } catch {
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-atlas-bg p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm bg-atlas-card rounded-xl shadow-lg p-8 border border-atlas-border">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-bold text-atlas-text">
            Atlas
          </h1>
          <p className="text-atlas-muted text-sm mt-1">
            Plataforma ACXE + Q2P
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-atlas-text mb-1"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-atlas-border bg-atlas-bg text-atlas-text placeholder:text-atlas-muted focus:outline-none focus:ring-2 focus:ring-acxe"
              placeholder="seu@email.com.br"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-atlas-text mb-1"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-atlas-border bg-atlas-bg text-atlas-text placeholder:text-atlas-muted focus:outline-none focus:ring-2 focus:ring-acxe"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="text-sm text-crit bg-crit/10 border border-crit/20 rounded-lg px-3 py-2"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-acxe text-white font-medium hover:bg-acxe/90 focus:outline-none focus:ring-2 focus:ring-acxe focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-atlas-muted mt-6">
          <a href="/forgot-password" className="hover:text-acxe underline">
            Esqueci minha senha
          </a>
        </p>
      </div>
    </div>
  );
}
