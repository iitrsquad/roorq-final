'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Loader2, ShieldCheck, CreditCard, Banknote, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR } from '@/lib/utils/currency';

interface CartItem {
  productId: string;
  quantity: number;
  product?: {
    id: string;
    name: string;
    price: number;
  };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi'>('cod');
  const [formData, setFormData] = useState({
    hostel: '',
    roomNumber: '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;
      
      if (!user) {
        router.push('/auth?redirect=/checkout');
        return;
      }

      setUser(user);

      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
          console.error("Profile load error:", profileError);
          // Don't block, just don't prefill
      }

      if (profile) {
        setUserProfile(profile);
        setFormData({
          hostel: profile.hostel || '',
          roomNumber: profile.room_number || '',
          phone: profile.phone || '',
        });
      }

      // Load cart
      const cartData = JSON.parse(localStorage.getItem('cart') || '[]');
      
      if (cartData.length === 0) {
          setLoading(false);
          return;
      }

      const products = await Promise.all(
        cartData.map(async (item: CartItem) => {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, price')
            .eq('id', item.productId)
            .single();
          
          if (error) {
              console.error(`Failed to load product ${item.productId}:`, error);
              return null;
          }
          return { ...item, product: data };
        })
      );

      setCart(products.filter((p): p is CartItem => !!p && !!p.product));
    } catch (err: any) {
        console.error("Checkout load error:", err);
        setError("Failed to load checkout data. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayPayment = async (orderId: string, amount: number) => {
    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, orderId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate payment');
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: 'Roorq',
        description: 'Order Payment',
        order_id: data.id,
        handler: function (response: any) {
          // Payment success - verify signature on backend
          fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  orderId: orderId // Internal Order ID
              })
            }).then(async (verifyRes) => {
              if (verifyRes.ok) {
                  localStorage.removeItem('cart');
                  toast.success('Payment successful!');
                  router.push(`/orders/${orderId}?payment=success`);
              } else {
                  toast.error('Payment verification failed. Please contact support.');
                  router.push(`/orders/${orderId}`);
              }
            }).catch(err => {
                console.error("Verify error:", err);
                toast.error("Network error during verification. Please check your order status.");
                router.push(`/orders/${orderId}`);
            });
        },
        prefill: {
          name: userProfile?.full_name || '',
          email: user?.email || '',
          contact: formData.phone || '',
        },
        notes: {
          address: `${formData.hostel}, ${formData.roomNumber}`,
        },
        theme: {
          color: '#000000',
        },
        modal: {
          ondismiss: function() {
            setSubmitting(false);
            toast('Payment cancelled. Redirecting to order details...', { icon: 'ℹ️' });
            localStorage.removeItem('cart'); // Cart is converted to order, clear it
            router.push(`/orders/${orderId}`);
          }
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response: any) {
        toast.error(response.error.description || 'Payment failed');
        setSubmitting(false);
        localStorage.removeItem('cart');
        router.push(`/orders/${orderId}`);
      });
      rzp1.open();
    } catch (err: any) {
        console.error("Razorpay init error:", err);
        toast.error(err.message || "Failed to start payment. Please try again.");
        setSubmitting(false);
        // If we failed *after* creating the order but *before* opening razorpay, we might want to redirect to order page anyway if the order was created successfully in DB? 
        // The logic below handles order creation first. If that succeeds, we are committed.
        router.push(`/orders/${orderId}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setSubmitting(true);

    try {
      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          hostel: formData.hostel,
          room_number: formData.roomNumber,
          phone: formData.phone,
        })
        .eq('id', user.id);
        
      if (updateError) {
          console.warn("Failed to update profile address:", updateError);
          // Continue execution, not critical blocking
      }

      // Calculate total
      const total = cart.reduce((sum, item) => {
        return sum + (item.product?.price || 0) * item.quantity;
      }, 0);

      // Get current drop
      const { data: currentDrop } = await supabase
        .from('drops')
        .select('id')
        .eq('status', 'live')
        .single();

      // Create order
      const orderNumber = `ROORQ-${Date.now()}`;
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          drop_id: currentDrop?.id || null,
          order_number: orderNumber,
          status: 'reserved', // Start as reserved to hold stock
          payment_method: paymentMethod,
          payment_status: 'pending',
          total_amount: total,
          delivery_hostel: formData.hostel,
          delivery_room: formData.roomNumber,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items and reserve inventory
      for (const item of cart) {
        // Create order item
        const { error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: order.id,
            product_id: item.productId,
            quantity: item.quantity,
            price: item.product?.price || 0,
          });
          
        if (itemError) {
            // Critical error: partial order created. Ideally rollback (Supabase doesn't support cross-table transactions easily in client)
            // For now, throw and let user retry or contact support.
            throw new Error(`Failed to add item ${item.product?.name} to order.`);
        }

        // Reserve inventory (atomic update)
        const { error: reserveError } = await supabase.rpc('reserve_inventory', {
          p_product_id: item.productId,
          p_quantity: item.quantity,
        });

        if (reserveError) {
          throw new Error(`Failed to reserve inventory for ${item.product?.name}: ${reserveError.message}`);
        }

        // Create inventory reservation
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        await supabase
          .from('inventory_reservations')
          .insert({
            product_id: item.productId,
            user_id: user.id,
            quantity: item.quantity,
            expires_at: expiresAt.toISOString(),
          });
      }

      if (paymentMethod === 'cod') {
        // Clear cart and redirect
        await supabase.from('orders').update({ status: 'placed' }).eq('id', order.id);
        
        localStorage.removeItem('cart');
        router.push(`/orders/${order.id}`);
      } else {
        // Initiate UPI Payment
        await handleRazorpayPayment(order.id, total);
      }

    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to place order. Please try again.');
      setSubmitting(false);
    }
  };

  const subtotal = cart.reduce((sum, item) => {
    return sum + (item.product?.price || 0) * item.quantity;
  }, 0);

  const showUPI = userProfile?.first_cod_done === true;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
      return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Navbar />
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">Checkout Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button onClick={() => window.location.reload()} className="bg-black text-white px-6 py-2 rounded font-bold uppercase">Retry</button>
                </div>
            </div>
            <Footer />
        </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <h1 className="text-4xl font-black uppercase tracking-tighter mb-8">Checkout</h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Delivery Information */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-xl font-black uppercase tracking-wide mb-6 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6" /> Delivery Details
              </h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase text-xs tracking-widest mb-2">Hostel / Bhawan</label>
                    <input
                      type="text"
                      required
                      value={formData.hostel}
                      onChange={(e) => setFormData({ ...formData, hostel: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 focus:border-black outline-none font-medium transition-colors"
                      placeholder="e.g. Rajendra Bhawan"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-xs tracking-widest mb-2">Room Number</label>
                    <input
                      type="text"
                      required
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 focus:border-black outline-none font-medium transition-colors"
                      placeholder="e.g. A-201"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-xs tracking-widest mb-2">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 focus:border-black outline-none font-medium transition-colors"
                    placeholder="+91 9876543210"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used for delivery coordination only.</p>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-xl font-black uppercase tracking-wide mb-6 flex items-center gap-2">
                <CreditCard className="w-6 h-6" /> Payment Method
              </h2>
              
              <div className="space-y-4">
                <label 
                  className={`flex items-start p-4 border-2 cursor-pointer transition-all ${
                    paymentMethod === 'cod' 
                      ? 'border-black bg-black text-white' 
                      : 'border-gray-200 hover:border-black'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    className="mt-1 mr-4 accent-white"
                  />
                  <div className="flex-1">
                    <div className="font-black uppercase tracking-widest flex items-center gap-2">
                      <Banknote className="w-5 h-5" /> Cash on Delivery (COD)
                    </div>
                    <div className={`text-sm mt-1 ${paymentMethod === 'cod' ? 'text-gray-300' : 'text-gray-500'}`}>
                      Pay cash or UPI when the rider arrives at your hostel.
                    </div>
                  </div>
                </label>

                <label 
                  className={`flex items-start p-4 border-2 transition-all ${
                    !showUPI 
                      ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' 
                      : paymentMethod === 'upi'
                        ? 'border-black bg-black text-white cursor-pointer'
                        : 'border-gray-200 hover:border-black cursor-pointer'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="upi"
                    checked={paymentMethod === 'upi'}
                    onChange={() => showUPI && setPaymentMethod('upi')}
                    disabled={!showUPI}
                    className="mt-1 mr-4 accent-white"
                  />
                  <div className="flex-1">
                    <div className="font-black uppercase tracking-widest flex items-center gap-2">
                      <CreditCard className="w-5 h-5" /> UPI / Online Payment
                    </div>
                    <div className={`text-sm mt-1 ${
                      !showUPI 
                        ? 'text-gray-500' 
                        : paymentMethod === 'upi' ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {!showUPI 
                        ? '🔒 Unlocks after your first successful COD delivery.' 
                        : 'Instant payment via UPI apps (GPay, PhonePe, Paytm).'}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border-2 border-black p-6 sticky top-24 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-xl font-black uppercase tracking-wide mb-6">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                {cart.map((item) => (
                  <div key={item.productId} className="flex justify-between items-start text-sm">
                    <div>
                      <p className="font-bold">{item.product?.name}</p>
                      <p className="text-gray-500 text-xs uppercase">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-bold">{formatINR((item.product?.price || 0) * item.quantity)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t-2 border-black pt-4 mb-6">
                <div className="flex justify-between text-xl font-black uppercase">
                  <span>Total</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-black text-white py-4 font-black uppercase tracking-widest hover:bg-gray-800 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                  </>
                ) : (
                  paymentMethod === 'upi' ? 'Pay Now' : 'Place Order'
                )}
              </button>
              
              <p className="text-center text-[10px] text-gray-400 mt-4 uppercase font-bold tracking-widest">
                Secure Checkout • 24h Delivery
              </p>
            </div>
          </div>
        </form>
      </div>

      <Footer />
    </div>
  );
}
