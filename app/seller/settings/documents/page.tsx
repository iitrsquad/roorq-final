'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const STORAGE_BUCKET = 'vendor-documents'

const DOCS = [
  { label: 'PAN Card', type: 'pan_card' },
  { label: 'GST Certificate', type: 'gst_certificate' },
  { label: 'Bank Proof', type: 'bank_proof' },
  { label: 'Address Proof', type: 'address_proof' },
  { label: 'Identity Proof', type: 'identity_proof' },
  { label: 'Business Registration', type: 'business_registration' },
] as const

export default function SellerDocumentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(false)

  const handleUpload = async (docType: typeof DOCS[number]['type'], file?: File) => {
    if (!file) return
    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Please sign in')

      const ext = file.name.split('.').pop() || 'pdf'
      const filePath = `${auth.user.id}/${docType}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: publicUrl } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
      if (!publicUrl?.publicUrl) throw new Error('Failed to get document URL')

      const { error: insertError } = await supabase
        .from('vendor_documents')
        .insert({
          vendor_id: auth.user.id,
          document_type: docType,
          document_url: publicUrl.publicUrl,
          status: 'pending',
        })

      if (insertError) throw insertError
      toast.success('Document uploaded')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Documents</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {DOCS.map((doc) => (
          <div key={doc.type} className="border bg-white p-4 rounded-lg shadow">
            <p className="font-semibold mb-2">{doc.label}</p>
            <input
              type="file"
              disabled={loading}
              onChange={(e) => handleUpload(doc.type, e.target.files?.[0])}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
