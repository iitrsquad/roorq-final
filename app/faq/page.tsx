import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FAQ from '@/components/FAQ';

export default function FAQPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-12 text-center">
            Help Center
          </h1>
          <FAQ />
        </div>
      </main>
      <Footer />
    </div>
  );
}

