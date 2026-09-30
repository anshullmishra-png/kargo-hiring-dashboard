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
    <form onSubmit={submit} className="card mx-auto mt-24 max-w-xs space-y-3">
      <h1 className="font-semibold">Kargo Hiring</h1>
      <input className="input" type="password" autoFocus placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn btn-primary w-full">Enter</button>
    </form>
  )
}
