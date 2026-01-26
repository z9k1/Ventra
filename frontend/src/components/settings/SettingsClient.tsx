'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

import { apiRequest } from '@/lib/api'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/settings'

const schema = z.object({
  apiBaseUrl: z.string().url('Informe uma URL valida'),
  apiKey: z.string().min(1, 'Informe a API key')
})

type FormData = z.infer<typeof schema>

export default function SettingsClient() {
  const { toast } = useToast()
  const [testing, setTesting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_SETTINGS
  })

  useEffect(() => {
    form.reset(loadSettings())
  }, [form])

  const onSubmit = (data: FormData) => {
    saveSettings({ apiBaseUrl: data.apiBaseUrl, apiKey: data.apiKey })
    toast({ title: 'Salvo', description: 'Configuracoes atualizadas.', variant: 'success' })
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      saveSettings(form.getValues())
      await apiRequest('/balance')
      toast({ title: 'Conectado', description: 'Backend respondeu /balance.', variant: 'success' })
    } catch (error: any) {
      toast({ title: 'Erro', description: error?.message || 'Falha ao conectar', variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure API_BASE_URL e API_KEY.</p>
      </div>

      <Card className="p-5">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">API Base URL</label>
            <input
              className="w-full rounded-[16px] border border-border bg-black/20 px-4 py-3"
              placeholder="http://localhost:8000"
              {...form.register('apiBaseUrl')}
            />
            {form.formState.errors.apiBaseUrl && (
              <p className="text-xs text-red-400">{form.formState.errors.apiBaseUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">API Key</label>
            <input
              className="w-full rounded-[16px] border border-border bg-black/20 px-4 py-3"
              placeholder=""
              {...form.register('apiKey')}
            />
            {form.formState.errors.apiKey && (
              <p className="text-xs text-red-400">{form.formState.errors.apiKey.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" disabled={testing} onClick={testConnection}>
              Testar conexao
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Card>

      <Card className="p-5 text-sm text-muted-foreground">
        Dica: o frontend chama sempre <span className="text-foreground font-mono">/api/proxy</span> e injeta as configuracoes via headers.
      </Card>
    </div>
  )
}
