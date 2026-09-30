'use client'

export default function LogoutButton() {
  return (
    <button
      className="font-medium text-inkmut hover:text-ink"
      onClick={async () => {
        await fetch('/api/logout', { method: 'POST' })
        window.location.href = '/login'
      }}
    >
      Log out
    </button>
  )
}
