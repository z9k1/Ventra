import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-2">VentraSim</h1>
      <p className="text-sm text-zinc-600 mb-4">Merchant Simulator - Webhooks e retries</p>
      <Link href="/events" className="text-blue-600 underline">
        Ver eventos
      </Link>
    </main>
  )
}
