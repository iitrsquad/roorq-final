import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ShippingPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black uppercase tracking-tighter mb-8">Shipping Policy</h1>
        <div className="prose prose-gray max-w-none">
          <h3 className="text-xl font-bold uppercase mt-8 mb-4">24-Hour Campus Delivery</h3>
          <p>We operate a hyper-local delivery network within IIT Roorkee.</p>
          
          <div className="bg-gray-100 p-6 my-6 border-l-4 border-black">
            <p className="font-bold uppercase">Delivery Window: 6 PM - 9 PM Daily</p>
          </div>

          <h3 className="text-xl font-bold uppercase mt-8 mb-4">Delivery Locations</h3>
          <p>We deliver to all Bhawans (Hostels) and faculty residences within the campus gates.</p>
          
          <h3 className="text-xl font-bold uppercase mt-8 mb-4">Missed Deliveries</h3>
          <p>If you are not available to collect your order, our rider will attempt one re-delivery the following day. After two failed attempts, the order will be cancelled.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

