import { useEffect, useState } from 'react'
import type { Meta } from '../types'
import { api } from './api'

let cached: Meta | null = null

export function useMeta(): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(cached)
  useEffect(() => {
    if (cached) return
    api.meta().then((m) => {
      cached = m
      setMeta(m)
    })
  }, [])
  return meta
}
