'use client'

import { useEffect, useState } from 'react'

const allowedEnvs = ['local', 'sandbox', 'staging'] as const
type Env = (typeof allowedEnvs)[number]

export default function FailureModeToggle() {
  const [env, setEnv] = useState<Env>('sandbox')
  const [mode, setMode] = useState<string>('normal')
  const [timeoutMs, setTimeoutMs] = useState<number>(15000)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/dev/mode/${env}`)
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setMode(data.mode || 'normal')
          setTimeoutMs(data.timeoutMs || 15000)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [env])

  const handleModeChange = async (newMode: string, newTimeout?: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dev/mode/${env}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode, timeoutMs: newTimeout ?? timeoutMs })
      })
      const data = await res.json()
      setMode(data.mode)
      if (data.timeoutMs) setTimeoutMs(data.timeoutMs)
    } catch (err) {
      console.error('Failed to update mode', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-6 mb-8 p-5 bg-white border rounded-xl shadow-sm">
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ambiente</label>
        <select
          value={env}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEnv(e.target.value as Env)}
          className="block w-32 text-sm font-medium border-zinc-200 rounded-lg bg-zinc-50 focus:ring-zinc-500 focus:border-zinc-500"
        >
          <option value="local">Local</option>
          <option value="sandbox">Sandbox</option>
          <option value="staging">Staging</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Modo de Simulação</label>
        <div className="flex p-1 bg-zinc-100 rounded-lg gap-1">
          {['normal', 'offline', 'timeout'].map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              disabled={loading}
              className={`text-xs px-4 py-1.5 rounded-md font-medium transition ${
                mode === m
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-white/50'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {mode === 'timeout' && (
        <div className="space-y-1 animate-in fade-in slide-in-from-left-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Timeout (ms)</label>
          <input
            type="number"
            step={500}
            min={0}
            value={timeoutMs}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeoutMs(Number(e.target.value))}
            onBlur={() => handleModeChange('timeout')}
            className="block w-24 text-sm font-medium border-zinc-200 rounded-lg bg-zinc-50 focus:ring-zinc-500 focus:border-zinc-500"
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <div className="w-3 h-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
            Salvando...
          </div>
        )}

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-colors ${
          mode === 'normal' ? 'bg-green-50 text-green-700 border-green-200' :
          mode === 'offline' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            mode === 'normal' ? 'bg-green-500' :
            mode === 'offline' ? 'bg-red-500' :
            'bg-amber-500'
          }`} />
          MODE: {mode.toUpperCase()}
        </div>
      </div>
    </div>
  )
}
