'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface PaymentRetryProps {
  orderId: string
  amount: number
  userName?: string
  userEmail?: string
  userPhone?: string
}

export default function PaymentRetry({ orderId, amount, userName, userEmail, userPhone }: PaymentRetryProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRetry = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment')

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: 'Roorq',
        description: `Order #${orderId.slice(0, 8)}`,
        order_id: data.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId
              }),
            })
            
            const verifyData = await verifyRes.json()
            if (!verifyRes.ok) throw new Error(verifyData.error)
            
            toast.success('Payment successful!')
            // Removed router.refresh() - use replace to navigate and avoid session issues
            router.replace(`/orders/${orderId}?payment=success`)
          } catch (error) {
            console.error('Payment verification failed:', error)
            toast.error('Payment verification failed. Please contact support.')
          }
        },
        prefill: {
          name: userName || 'Roorq Customer',
          email: userEmail || '',
          contact: userPhone || '',
        },
        theme: {
          color: '#000000',
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
      
    } catch (error) {
      console.error('Retry failed:', error)
      toast.error('Failed to retry payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 mb-8"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      Retry Payment
    </button>
  )
}
