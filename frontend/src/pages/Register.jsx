import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Register() {
  const { register } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register(form.username, form.email, form.password, form.password2);
      navigate('/');
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        Object.values(err.response?.data || {})
          .flat()
          .join(' ') ||
        'registration failed';
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
          <p>// create_new_account()</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="reg-user">// username</label>
            <input
              id="reg-user"
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="enter_username"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="reg-email">// email</label>
            <input
              id="reg-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@domain.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="reg-pass">// password</label>
            <input
              id="reg-pass"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="reg-pass2">// confirm_password</label>
            <input
              id="reg-pass2"
              type="password"
              value={form.password2}
              onChange={(e) => setForm({ ...form, password2: e.target.value })}
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
            {loading ? '// loading...' : '>> CREATE_ACCOUNT'}
          </button>
        </form>

        <p className="auth-link">
          // have account? <Link to="/login">SIGN_IN</Link>
        </p>
      </div>
    </div>
  );
}