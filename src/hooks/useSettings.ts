import { useState, useCallback } from 'react'
import { getSettings, setSettings } from '../utils/storage'
import type { AppSettings } from '../types'

export function useSettings() {
  const [settings, setLocalSettings] = useState<AppSettings>(getSettings)

  const save = useCallback((next: AppSettings) => {
    setSettings(next)
    setLocalSettings(next)
  }, [])

  return { settings, save }
}
