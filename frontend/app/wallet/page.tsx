import WalletPageClient from '@/components/wallet/WalletPageClient'

export default function WalletPage({
  searchParams
}: {
  searchParams?: { orderId?: string }
}) {
  return <WalletPageClient initialOrderId={searchParams?.orderId ?? ''} />
}