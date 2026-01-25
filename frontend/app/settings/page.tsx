'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { loadSettings, persistSettings } from '@/lib/settings'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { clearLocalOrders } from '@/lib/ordersStore'
import { apiRequest } from '@/lib/apiClient'

const settingsSchema = z.object({
  apiBaseUrl: z.string().url(),
  apiKey: z.string().min(1),
  useProxy: z.boolean()
})

type SettingsForm = z.infer<typeof settingsSchema>

export default function SettingsPage() {
  const [status, setStatus] = useState<string | null>(null)
  const { register, handleSubmit, reset } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: loadSettings()
  })

  useEffect(() => {
    reset(loadSettings())
  }, [reset])

  const onSubmit = (data: SettingsForm) => {
    persistSettings(data)
    reset(data)
    setStatus('Configurações salvas!')
  }

  const testConnection = async () => {
    setStatus('Testando...')
    try {
      await apiRequest('/balance')
      setStatus('Conectado com sucesso!')
    } catch (error) {
      setStatus('Erro ao conectar: ' + (error as Error).message)
    }
  }

  const resetLocal = () => {
    clearLocalOrders()
    setStatus('Dados locais removidos')
  }

  return (
    <div className="space-y-5 pb-28">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-textSecondary">Settings</p>
        <h1 className="text-2xl font-semibold">API Configuration</h1>
      </div>
      <Card className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="text-[11px] uppercase tracking-[0.3em] text-textSecondary">API Base URL</label>
          <input className="w-full rounded-[16px] bg-mutedChip border border-stroke p-3 text-sm" {...register('apiBaseUrl')} />
          <label className="text-[11px] uppercase tracking-[0.3em] text-textSecondary">API Key</label>
          <input className="w-full rounded-[16px] bg-mutedChip border border-stroke p-3 text-sm" {...register('apiKey')} />
          <label className="text-[11px] uppercase tracking-[0.3em] text-textSecondary flex items-center gap-2">
            <input type="checkbox" {...register('useProxy')} /> Use Next Proxy
          </label>
          <div className="space-y-2">
            <Button type="submit">Salvar</Button>
            <Button type="button" variant="ghost" onClick={testConnection}>
              Testar conexão
            </Button>
            <Button type="button" variant="ghost" onClick={resetLocal}>
              Resetar dados locais
            </Button>
          </div>
        </form>
      </Card>
      {status && <p className="text-sm text-accent">{status}</p>}
    </div>
  )
}
