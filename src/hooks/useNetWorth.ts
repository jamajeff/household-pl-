import { useState, useCallback } from 'react'
import { getAssets, setAssets, getDebts, setDebts } from '../utils/storage'
import type { Asset, Debt } from '../types'

export function useNetWorth() {
  const [assets, setLocalAssets] = useState<Asset[]>(getAssets)
  const [debts, setLocalDebts] = useState<Debt[]>(getDebts)

  const addAsset = useCallback((asset: Asset) => {
    const next = [...assets, asset]
    setAssets(next)
    setLocalAssets(next)
  }, [assets])

  const updateAsset = useCallback((id: string, updates: Partial<Asset>) => {
    const next = assets.map((a) => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a)
    setAssets(next)
    setLocalAssets(next)
  }, [assets])

  const deleteAsset = useCallback((id: string) => {
    const next = assets.filter((a) => a.id !== id)
    setAssets(next)
    setLocalAssets(next)
  }, [assets])

  const addDebt = useCallback((debt: Debt) => {
    const next = [...debts, debt]
    setDebts(next)
    setLocalDebts(next)
  }, [debts])

  const updateDebt = useCallback((id: string, updates: Partial<Debt>) => {
    const next = debts.map((d) => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d)
    setDebts(next)
    setLocalDebts(next)
  }, [debts])

  const deleteDebt = useCallback((id: string) => {
    const next = debts.filter((d) => d.id !== id)
    setDebts(next)
    setLocalDebts(next)
  }, [debts])

  const totalAssets = assets.reduce((sum, a) => sum + a.value, 0)
  const totalDebts = debts.reduce((sum, d) => sum + d.balance, 0)
  const netWorth = totalAssets - totalDebts

  return {
    assets, debts,
    totalAssets, totalDebts, netWorth,
    addAsset, updateAsset, deleteAsset,
    addDebt, updateDebt, deleteDebt,
  }
}
