import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        Object.values(err.response?.data || {})
          .flat()
          .join(' ') ||
        'Credenciales inválidas';
      setError(`// ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-card">
        <button type="button" className="auth-theme-btn" onClick={toggle}>
          {theme === 'dark' ? 'LT' : 'DK'}
        </button>

        <div className="auth-brand">
          <h1>
            UNI<em>BOT</em>
          </h1>
          <p>// academic ecosystem v2.0</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="login-user">// username</label>
            <input
              id="login-user"
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="enter_username"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="login-pass">// password</label>
            <input
              id="login-pass"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? '// loading...' : '>> SIGN_IN'}
          </button>
        </form>

        <p className="auth-link">
          // no account? <Link to="/register">REGISTER</Link>
        </p>
      </div>
    </div>
  );
}