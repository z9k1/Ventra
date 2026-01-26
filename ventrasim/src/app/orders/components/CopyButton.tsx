'use client'

import { useState } from 'react'

type CopyButtonProps = {
  value: string
}

export default function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch (error) {
      console.error('copy failed', error)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 transition hover:border-zinc-400"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
