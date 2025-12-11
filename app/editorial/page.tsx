import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';

export default function EditorialPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <div className="py-20 px-4 text-center border-b border-gray-100">
          <h1 className="text-6xl md:text-9xl font-black uppercase tracking-tighter mb-6">Editorial</h1>
          <p className="text-xl uppercase tracking-widest font-mono text-gray-500">Stories from the Roorq Community</p>
        </div>

        <div className="max-w-[1800px] mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {[
              {
                title: 'The Rise of Gorpcore on Campus',
                date: 'Nov 24, 2024',
                image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
                excerpt: 'Why technical outerwear is taking over the lecture halls.'
              },
              {
                title: 'Styling Vintage Jerseys',
                date: 'Nov 20, 2024',
                image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80',
                excerpt: 'How to wear oversized sports jerseys without looking like you just left the gym.'
              },
              {
                title: 'The History of Carhartt',
                date: 'Nov 15, 2024',
                image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
                excerpt: 'From railroad workers to streetwear icons.'
              }
            ].map((article, idx) => (
              <div key={idx} className="group cursor-pointer">
                <div className="aspect-[16/9] relative overflow-hidden bg-gray-100 mb-6">
                  <Image 
                    src={article.image} 
                    alt={article.title} 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform duration-700" 
                  />
                </div>
                <div className="flex items-center gap-4 mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                  <span>{article.date}</span>
                  <span className="w-8 h-[1px] bg-gray-300"></span>
                  <span>Style Guide</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4 group-hover:text-gray-600 transition-colors">
                  {article.title}
                </h2>
                <p className="text-gray-600 font-mono text-sm leading-relaxed max-w-xl">
                  {article.excerpt}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

