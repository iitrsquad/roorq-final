import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import OrderSuccessConfetti from '@/components/OrderSuccessConfetti';
// PHASE 1: COD Only - PaymentRetry component commented out
// import PaymentRetry from '@/components/PaymentRetry';
import { AlertCircle } from 'lucide-react';

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4">Sign In Required</h2>
            <a href={`/auth?redirect=/orders/${params.id}`} className="bg-black text-white px-6 py-3 font-bold uppercase tracking-widest">
              Login to View Order
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        product:products (*)
      )
    `)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !order) {
    if (error?.code === 'PGRST116') {
        // Not found or no access (RLS)
        notFound();
    }
    console.error('Order fetch error:', error);
    return (
        <div className="min-h-screen flex flex-col font-sans">
          <Navbar />
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Error Loading Order</h2>
              <p className="text-gray-600 mb-6">We couldn't retrieve the order details. This might be a temporary issue or the order doesn't exist.</p>
              <a href="/profile" className="text-blue-600 hover:underline font-bold">Return to Profile</a>
            </div>
          </div>
          <Footer />
        </div>
    );
  }

  // Fetch user profile for contact details needed in retry
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, phone')
    .eq('id', user.id)
    .single();

  const statusSteps = [
    { key: 'placed', label: 'Order Placed' },
    { key: 'reserved', label: 'Reserved' },
    { key: 'packed', label: 'Packed' },
    { key: 'out_for_delivery', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const currentStatusIndex = statusSteps.findIndex((s) => s.key === order.status);

  // PHASE 1: COD Only - Payment retry disabled (UPI not available)
  // Check if payment retry is needed
  // Condition: Payment Method is UPI AND Payment Status is Pending/Failed AND Order is NOT Cancelled
  const showRetry = false; // PHASE 1: COD Only - UPI disabled
  // const showRetry = order.payment_method === 'upi' && 
  //                   (order.payment_status === 'pending' || order.payment_status === 'failed') &&
  //                   order.status !== 'cancelled';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold mb-8">Order #{order.order_number}</h1>

        <OrderSuccessConfetti />

        {/* PHASE 1: COD Only - PaymentRetry component commented out */}
        {/* {showRetry && (
          <PaymentRetry 
            orderId={order.id} 
            amount={order.total_amount}
            userName={profile?.full_name || ''}
            userEmail={user.email || ''}
            userPhone={profile?.phone || ''}
          />
        )} */}

        {/* Order Status */}
        <div className="bg-gray-50 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-4">Order Status</h2>
          <div className="flex items-center justify-between overflow-x-auto pb-4 md:pb-0">
            {statusSteps.map((step, index) => (
              <div key={step.key} className="flex items-center flex-1 min-w-[80px]">
                <div className="flex flex-col items-center w-full">
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-semibold text-xs md:text-base ${
                      index <= currentStatusIndex
                        ? 'bg-black text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="text-[10px] md:text-xs mt-2 text-center font-bold uppercase tracking-wide">{step.label}</span>
                </div>
                {index < statusSteps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      index < currentStatusIndex ? 'bg-black' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Order Items</h2>
          <div className="space-y-4">
            {order.order_items?.map((item: any) => (
              <div
                key={item.id}
                className="flex gap-4 border-b pb-4"
              >
                {item.product?.images && item.product.images.length > 0 && (
                  <div className="relative w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={item.product.images[0]}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{item.product?.name}</h3>
                  <p className="text-gray-600 text-sm">Quantity: {item.quantity}</p>
                  <p className="text-gray-600 text-sm">Size: {item.product?.size}</p>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-lg">₹{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Information */}
        <div className="bg-gray-50 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-4">Delivery Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
               <p className="text-gray-500 uppercase text-xs font-bold tracking-widest mb-1">Address</p>
               <p className="font-medium">{order.delivery_hostel}, {order.delivery_room}</p>
            </div>
            <div>
               <p className="text-gray-500 uppercase text-xs font-bold tracking-widest mb-1">Payment</p>
               <p className="font-medium uppercase">{order.payment_method}</p>
               <p className={`text-xs font-bold uppercase ${order.payment_status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                 Status: {order.payment_status}
               </p>
            </div>
            <div className="md:col-span-2 border-t pt-4 mt-2">
               <div className="flex justify-between items-center text-xl font-bold">
                 <span>Total Amount</span>
                 <span>₹{order.total_amount.toFixed(2)}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Order Date */}
        <div className="text-xs text-gray-400 text-center font-mono uppercase tracking-widest">
          <p>Order ID: {order.order_number} • Placed on {new Date(order.created_at).toLocaleString()}</p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
