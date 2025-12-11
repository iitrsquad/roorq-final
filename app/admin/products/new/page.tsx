import { createClient } from '@/lib/supabase/server';
import AdminNav from '@/components/AdminNav';
import ProductForm from '@/components/ProductForm';
import { redirect } from 'next/navigation';

export default async function NewProductPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  // Fetch drops for selection
  const { data: drops } = await supabase
    .from('drops')
    .select('id, name')
    .neq('status', 'ended')
    .order('scheduled_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Add New Product</h1>
        <ProductForm drops={drops || []} />
      </div>
    </div>
  );
}

