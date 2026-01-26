import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-2">VentraSim</h1>
      <p className="text-sm text-zinc-600 mb-4">Merchant Simulator - Webhooks e retries</p>
      <div className="flex flex-col gap-2">
        <Link href="/events" className="text-blue-600 underline">
          Ver eventos
        </Link>
        <Link href="/orders" className="text-blue-600 underline">
          Dashboard de pedidos
        </Link>
      </div>
    </main>
  )
}
