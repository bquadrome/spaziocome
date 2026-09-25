import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const raw = email.trim()
    const loginEmail = raw.includes('@') ? raw : `${raw}@spaziocome.it`
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })
    setBusy(false)
    if (authError) setError(authError.message)
  }

  return (
    <div className="admin admin-login">
      <form className="edit-modal" onSubmit={onSubmit}>
        <h2>Area riservata</h2>
        <p className="admin-hint">Utente: spaziocome</p>
        <label className="admin-field">
          <span>Nome utente</span>
          <input type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="book-error">{error}</p> : null}
        <div className="edit-actions">
          <button className="btn-save" type="submit" disabled={busy}>
            {busy ? 'Accesso…' : 'Entra'}
          </button>
          <a className="btn-ghost" href="/">
            Sito
          </a>
        </div>
      </form>
    </div>
  )
}
