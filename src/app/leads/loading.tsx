export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-sky-400/20 border-t-sky-400 rounded-full animate-spin" />
        <p className="text-slate-500 font-mono text-sm tracking-widest uppercase">Loading leads…</p>
      </div>
    </div>
  )
}
