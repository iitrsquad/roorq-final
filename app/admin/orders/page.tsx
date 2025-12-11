import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatINR } from '@/lib/utils/currency';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = await createClient();

  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (searchParams.status) {
    query = query.eq('status', searchParams.status);
  }

  const { data: orders } = await query;

  const statuses = [
    { value: '', label: 'All' },
    { value: 'placed', label: 'Placed' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'packed', label: 'Packed' },
    { value: 'out_for_delivery', label: 'Out for Delivery' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div>
        <h1 className="text-4xl font-bold mb-8">Orders</h1>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {statuses.map((status) => (
            <Link
              key={status.value}
              href={`/admin/orders${status.value ? `?status=${status.value}` : ''}`}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                searchParams.status === status.value || (!searchParams.status && status.value === '')
                  ? 'bg-black text-white'
                  : 'bg-white text-black border border-gray-300 hover:border-black'
              }`}
            >
              {status.label}
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders && orders.length > 0 ? (
                  orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{order.order_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{order.delivery_hostel}</td>
                      <td className="px-6 py-4 whitespace-nowrap">Room {order.delivery_room}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold">{formatINR(order.total_amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded font-medium ${
                        order.payment_status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                          {order.payment_method.toUpperCase()}
                        {order.payment_status === 'paid' && ' ✓'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded font-medium ${
                          order.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                          : order.status === 'out_for_delivery'
                          ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/admin/orders/${order.id}`}
                        className="text-blue-600 hover:underline text-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
