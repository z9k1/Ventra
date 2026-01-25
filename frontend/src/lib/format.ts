export function formatBRL(cents: number) {
  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })

  return formatter.format(cents / 100)
}