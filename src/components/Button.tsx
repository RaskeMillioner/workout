import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sky-500 text-slate-950 active:bg-sky-400',
  secondary: 'bg-slate-800 text-slate-100 active:bg-slate-700 border border-slate-700',
  danger: 'bg-red-900/60 text-red-200 active:bg-red-900 border border-red-800',
  ghost: 'text-slate-400 active:text-slate-200',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export default function Button({ variant = 'secondary', className = '', ...rest }: Props) {
  return (
    <button
      // min-h-11 keeps every button at a comfortable touch target.
      className={`min-h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}
