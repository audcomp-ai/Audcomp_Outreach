'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Silently refreshes server data every 30 seconds.
// Keeps the dashboard in sync without a manual reload.
export default function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
