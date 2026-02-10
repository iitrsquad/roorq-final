'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'processing',
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
] as const

type VendorOrderStatusClientProps = {
  orderId: string
  initialStatus: string
  initialTrackingNumber?: string | null
  initialTrackingUrl?: string | null
}

export default function VendorOrderStatusClient({
  orderId,
  initialStatus,
  initialTrackingNumber,
  initialTrackingUrl,
}: VendorOrderStatusClientProps) {
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState(initialStatus)
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber ?? '')
  const [trackingUrl, setTrackingUrl] = useState(initialTrackingUrl ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('vendor_orders')
        .update({
          status,
          tracking_number: trackingNumber || null,
          tracking_url: trackingUrl || null,
        })
        .eq('id', orderId)

      if (error) throw error
      toast.success('Order updated')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border px-3 py-2 text-sm">
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Tracking #</label>
          <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Tracking URL</label>
          <input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} className="w-full border px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mt-3">
        <button onClick={handleSave} disabled={saving} className="bg-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Updates'}
        </button>
      </div>
    </div>
  )
}
