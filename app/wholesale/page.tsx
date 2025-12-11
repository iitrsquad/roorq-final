import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function WholesalePage() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-black uppercase tracking-tighter mb-8">Wholesale & Bulk</h1>
        <p className="mb-6">
          We supply vintage clothing to other campus resellers and student groups. If you are looking to buy in bulk (50+ pieces), we can offer wholesale rates.
        </p>
        <p className="font-bold">Contact: wholesale@roorq.com</p>
      </main>
      <Footer />
    </div>
  );
}

