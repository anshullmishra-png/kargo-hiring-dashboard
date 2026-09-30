'use client'
import { useState } from 'react'

export default function Login() {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    if (res.ok) window.location.href = '/'
    else setErr('Wrong password')
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-28 max-w-sm space-y-4 !p-8 shadow-card">
      <p className="eyebrow">Kargo · Hiring</p>
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight">Welcome back.</h1>
      <input className="input" type="password" autoFocus placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn btn-primary w-full !py-3">Enter</button>
    </form>
  )
}
