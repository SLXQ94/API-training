import { useState, type FormEvent } from 'react';
import { ApiError } from '../api';
import { Icon } from '../icons';
import { titleCase } from '../names';
import { login, register } from '../store';

const ROLL_RE = /^[A-Za-z0-9_-]{3,20}$/;

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [rollNo, setRollNo] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  function validate(): string {
    if (!ROLL_RE.test(rollNo.trim())) return 'Roll number must be 3-20 characters: letters, digits, - or _';
    if (isRegister && !name.trim()) return 'Please enter your name';
    if (password.length < 4) return isRegister ? 'Password must be at least 4 characters' : 'Enter your password';
    return '';
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur(); // hide the on-screen keyboard
    if (busy) return;
    const problem = validate();
    if (problem) return setError(problem);
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(rollNo, titleCase(name), password);
      else await login(rollNo, password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 0) setError("Can't reach the server. Check your connection and try again.");
        else if (err.status === 401) setError('Wrong roll number or password.');
        else if (err.status === 429) setError('Too many attempts. Wait a few seconds and try again.');
        else setError(err.message);
      } else setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isRegister ? 'login' : 'register');
    setError('');
  }

  return (
    <div className="login-page">
      <div className="login-band" />
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">
            <Icon name="chat" size={30} />
          </span>
          <span>Classroom Chat</span>
        </div>

        <h1>{isRegister ? 'Create your account' : 'Log in to continue'}</h1>
        <p className="login-sub">
          {isRegister ? 'Your roll number is your ID in the class.' : 'Use your roll number and password.'}
        </p>

        <form onSubmit={submit} noValidate>
          <label className="field">
            <span>Roll number</span>
            <input
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              autoComplete="username"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              maxLength={20}
              placeholder="e.g. 0827CS241239"
            />
          </label>

          {isRegister && (
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setName(titleCase(name))}
                autoComplete="name"
                maxLength={60}
                placeholder="How classmates will see you"
              />
            </label>
          )}

          <label className="field">
            <span>Password</span>
            <div className="field-pw">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={isRegister ? 'At least 4 characters' : 'Your password'}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={20} />
              </button>
            </div>
          </label>

          <div className="login-error" role="alert" aria-live="polite">
            {error}
          </div>

          <button className="btn btn-solid btn-wide" type="submit" disabled={busy}>
            {busy ? <span className="spinner" aria-label="Please wait" /> : isRegister ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="login-switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="link-btn" onClick={switchMode}>
            {isRegister ? 'Log in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
