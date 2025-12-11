import { createClient } from '@/lib/supabase/server';
import AdminNav from '@/components/AdminNav';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Phone, MapPin, Package, Truck, CheckCircle } from 'lucide-react';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      user:users(full_name, email, phone),
      items:order_items(
        quantity,
        price,
        product:products(name, images, size)
      )
    `)
    .eq('id', params.id)
    .single();

  if (!order) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-gray-500 hover:text-black mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-4">
              Order #{order.order_number}
              <span className={`px-3 py-1 text-sm rounded-full uppercase ${
                order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {order.status}
              </span>
            </h1>
            <p className="text-gray-500 mt-2">Placed on {new Date(order.created_at).toLocaleString()}</p>
          </div>
          
          {/* Actions would go here (e.g., Mark as Packed button) - requires client component */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
             {/* Items */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" /> Order Items
              </h2>
              <div className="divide-y">
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="py-4 flex gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded flex-shrink-0 relative overflow-hidden">
                      {item.product?.images?.[0] && (
                         <img src={item.product.images[0]} alt="" className="object-cover w-full h-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold">{item.product?.name || 'Unknown Item'}</h3>
                      <p className="text-sm text-gray-600">Size: {item.product?.size} | Qty: {item.quantity}</p>
                      <p className="font-mono">₹{item.price}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 mt-4 flex justify-between items-center font-bold text-lg">
                <span>Total</span>
                <span>₹{order.total_amount}</span>
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            {/* Customer */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Customer</h2>
              <p className="font-bold">{order.user?.full_name || 'Guest'}</p>
              <p className="text-gray-600">{order.user?.email}</p>
              <div className="flex items-center gap-2 mt-2 text-gray-600">
                <Phone className="w-4 h-4" />
                {order.user?.phone || 'No Phone'}
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" /> Delivery Details
              </h2>
              <div className="space-y-2">
                 <div className="flex items-start gap-2">
                   <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                   <div>
                     <p className="font-bold">{order.delivery_hostel}</p>
                     <p>Room {order.delivery_room}</p>
                     <p>IIT Roorkee</p>
                   </div>
                 </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Payment</h2>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Method</span>
                <span className="font-bold uppercase">{order.payment_method}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status</span>
                <span className={`uppercase font-bold ${
                  order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {order.payment_status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

