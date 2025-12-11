import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default async function ProfilePage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/auth?redirect=/profile');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold mb-8">My Profile</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block font-semibold mb-2">Email</label>
                  <p className="text-gray-700">{profile?.email || user.email}</p>
                </div>
                <div>
                  <label className="block font-semibold mb-2">Full Name</label>
                  <p className="text-gray-700">{profile?.full_name || 'Not set'}</p>
                </div>
                <div>
                  <label className="block font-semibold mb-2">Phone</label>
                  <p className="text-gray-700">{profile?.phone || 'Not set'}</p>
                </div>
                <div>
                  <label className="block font-semibold mb-2">Hostel</label>
                  <p className="text-gray-700">{profile?.hostel || 'Not set'}</p>
                </div>
                <div>
                  <label className="block font-semibold mb-2">Room Number</label>
                  <p className="text-gray-700">{profile?.room_number || 'Not set'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Payment Status</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>COD Available</span>
                  <span className="font-semibold text-green-600">✓ Always Available</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>UPI Payment</span>
                  {profile?.first_cod_done ? (
                    <span className="font-semibold text-green-600">✓ Unlocked</span>
                  ) : (
                    <span className="font-semibold text-gray-500">
                      Locked - Complete 1 COD order to unlock
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <Link
              href="/orders"
              className="block bg-white border rounded-lg p-6 hover:bg-gray-50 transition"
            >
              <h3 className="font-semibold mb-2">My Orders</h3>
              <p className="text-sm text-gray-600">View order history</p>
            </Link>
            <Link
              href="/referrals"
              className="block bg-white border rounded-lg p-6 hover:bg-gray-50 transition"
            >
              <h3 className="font-semibold mb-2">Referrals</h3>
              <p className="text-sm text-gray-600">Invite friends, get rewards</p>
            </Link>
            <div className="bg-white border rounded-lg p-6">
              <h3 className="font-semibold mb-2">Referral Code</h3>
              <p className="text-sm font-mono bg-gray-50 p-2 rounded">
                {profile?.referral_code || 'Loading...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

