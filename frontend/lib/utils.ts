import { twMerge } from 'tailwind-merge'

export function cn(...inputs: Array<string | undefined | boolean | null>) {
  return twMerge(inputs.filter(Boolean).join(' '))
}
