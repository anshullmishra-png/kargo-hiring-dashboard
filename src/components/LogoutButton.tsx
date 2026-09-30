'use client'

export default function LogoutButton() {
  return (
    <button
      className="text-gray-500 hover:text-black"
      onClick={async () => {
        await fetch('/api/logout', { method: 'POST' })
        window.location.href = '/login'
      }}
    >
      Log out
    </button>
  )
}
