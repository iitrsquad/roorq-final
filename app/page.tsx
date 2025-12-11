import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DropCountdown from '@/components/DropCountdown';
import { createClient } from '@/lib/supabase/server';
import ProductCard from '@/components/ProductCard';
import CommunityStrip from '@/components/CommunityStrip';
import FAQ from '@/components/FAQ';
import { ArrowRight, Check, Package, Zap, TrendingUp, ShieldCheck, Truck, CreditCard, Star, UserPlus, ShoppingBag, Clock, Quote } from 'lucide-react';

export default async function Home() {
  const supabase = await createClient();
  const serverTime = Date.now(); 
  
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(8);

  const now = new Date();
  const day = now.getDay(); 
  const hour = now.getHours();
  const isDropLive = day === 3 && hour >= 5 && hour < 18;

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-black pb-20 md:pb-0 selection:bg-black selection:text-white">
      <Navbar />
      
      {/* SECTION 1: Hero Banner (Strict Thrifted.com Clone) */}
      <section className="relative w-full h-[600px] md:h-[800px] bg-gray-100 overflow-hidden">
        {/* Background Image - Full Bleed */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=2070&auto=format&fit=crop"
            alt="Hero Background"
            className="w-full h-full object-cover object-center"
          />
        </div>
        
        {/* Content Overlay - Centered for Maximum Impact */}
        <div className="absolute inset-0 flex flex-col justify-center items-center z-10">
           {/* Massive Headline */}
           <h1 className="text-[15vw] md:text-[12rem] font-black uppercase tracking-tighter leading-[0.8] text-center mix-blend-hard-light drop-shadow-xl w-full px-4 pointer-events-none">
             <span className="text-red-600 block">Roorq</span>
             <span className="text-white block md:inline">Weekly</span>
             <span className="text-red-600 block md:inline">Drop</span>
           </h1>
           
           {/* "NOW LIVE" Overlay Effect */}
           <div className="mt-4 md:-mt-12 relative pointer-events-none">
             <h2 className="text-[12vw] md:text-[10rem] font-black uppercase tracking-tighter text-red-600 leading-none drop-shadow-2xl transform -rotate-2">
               Now Live
             </h2>
           </div>

           {/* Central CTA Group - The UX Sweet Spot */}
           <div className="mt-12 flex flex-col md:flex-row gap-6 items-center justify-center w-full max-w-2xl px-4">
             <Link
               href="/shop"
               className="group bg-white text-black px-10 py-4 text-sm font-black uppercase tracking-widest border-2 border-black hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center gap-3 min-w-[200px] justify-center"
             >
               Shop Drop <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </Link>
             
             <Link
               href="/mystery-box"
               className="group bg-black text-white px-10 py-4 text-sm font-black uppercase tracking-widest border-2 border-white hover:bg-white hover:text-black hover:border-black transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center gap-3 min-w-[200px] justify-center backdrop-blur-sm bg-opacity-80"
             >
               Bid Mystery Box <Zap className="w-4 h-4 fill-current" />
             </Link>
           </div>
        </div>

        {/* Badge - Bottom Left positioning (Quality Stamp) */}
        <div className="absolute bottom-12 left-6 md:left-12 z-20 flex flex-col items-start gap-2">
           <div className="bg-white text-black px-4 py-2 text-xs font-bold uppercase tracking-widest border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
             The Home of Vintage
           </div>
           <div className="bg-black text-white px-2 py-1 text-[10px] font-mono uppercase tracking-widest">
             Over 600k Items Sold
           </div>
        </div>
      </section>

      {/* COD Trust Strip */}
      <div className="bg-black text-white py-3 text-center border-b border-gray-800">
        <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest font-mono">
          COD-first on your first order • UPI unlocked after confirmed delivery • Campus delivery within 24 hours
        </p>
      </div>

      {/* SECTION 2: How Roorq Works (Technical Grid Background) */}
      <section className="py-16 border-b border-gray-100 bg-white relative overflow-hidden">
        {/* Technical Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>

        <div className="max-w-[1800px] mx-auto px-4 relative z-10">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-center mb-12">How Roorq Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center group">
              <div className="w-16 h-16 border-2 border-black flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors duration-300 rounded-none bg-white">
                <ShieldCheck className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2">Student Access</h3>
              <p className="text-[10px] text-gray-500 uppercase font-medium font-mono max-w-[150px]">Campus Fashion Platform</p>
            </div>
            <div className="flex flex-col items-center group">
              <div className="w-16 h-16 border-2 border-black flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors duration-300 rounded-none bg-white">
                <Package className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2">Factory New</h3>
              <p className="text-[10px] text-gray-500 uppercase font-medium font-mono max-w-[150px]">Brand New Surplus</p>
            </div>
            <div className="flex flex-col items-center group">
              <div className="w-16 h-16 border-2 border-black flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors duration-300 rounded-none bg-white">
                <CreditCard className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2">COD First</h3>
              <p className="text-[10px] text-gray-500 uppercase font-medium font-mono max-w-[150px]">Pay on Delivery</p>
            </div>
            <div className="flex flex-col items-center group">
              <div className="w-16 h-16 border-2 border-black flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors duration-300 rounded-none bg-white">
                <Truck className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2">24h Delivery</h3>
              <p className="text-[10px] text-gray-500 uppercase font-medium font-mono max-w-[150px]">Direct to Hostel</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Countdown Timer */}
      <DropCountdown initialServerTime={serverTime} />

      {/* SECTION 4: This Week's Drop Preview */}
      <section className="py-16 max-w-[1800px] mx-auto px-4">
        <div className="flex justify-between items-end mb-8 border-b-2 border-black pb-4">
          <div>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-2 leading-none">
              This Week's Drop
            </h2>
            <p className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-widest font-mono">
              Limited Quantities • Once Sold Out, Gone Forever
            </p>
          </div>
          <Link href="/shop" className="hidden md:inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest hover:text-gray-600 transition">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products && products.length > 0 ? (
            products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            [1, 2, 3, 4, 5, 6, 7, 8].map((_: number, idx: number) => (
              <div key={idx} className="group relative aspect-[3/4] bg-gray-100 border border-transparent hover:border-black transition-colors duration-300">
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs uppercase font-bold tracking-widest">
                  Coming Soon
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="mt-12 text-center md:hidden">
          <Link href="/shop" className="inline-block border-2 border-black px-8 py-3 text-sm font-black uppercase tracking-widest hover:bg-black hover:text-white transition rounded-none">
            View All Items
          </Link>
        </div>
      </section>

      {/* SECTION: Shop Men/Women/Outlet Trio */}
      <section className="py-8 max-w-[1800px] mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Men's Column */}
          <div className="relative h-[650px] group overflow-hidden border border-transparent hover:border-black transition-colors duration-300">
            <img 
              src="https://images.unsplash.com/photo-1488161628813-99c974fc5fe2?auto=format&fit=crop&w=800&q=80"
              alt="Shop Men's"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[85%] bg-white p-6 text-center shadow-xl border border-black">
              <h3 className="text-3xl font-black uppercase mb-4 tracking-tighter">Shop Men's</h3>
              <div className="flex flex-col gap-2 text-xs font-bold tracking-widest uppercase">
                <Link href="/shop?category=mens" className="hover:text-gray-500 transition border-b border-gray-200 pb-1">Men's Vintage</Link>
                <Link href="/shop?category=t-shirt" className="hover:text-gray-500 transition border-b border-gray-200 pb-1">Tops & T-Shirts</Link>
                <Link href="/shop?category=trousers" className="hover:text-gray-500 transition">Vintage Trousers</Link>
              </div>
            </div>
          </div>

          {/* Women's Column */}
          <div className="relative h-[650px] group overflow-hidden border border-transparent hover:border-black transition-colors duration-300">
             <img 
              src="https://images.unsplash.com/photo-1503341455253-b2e72333dbdb?auto=format&fit=crop&w=800&q=80"
              alt="Shop Women's"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[85%] bg-white p-6 text-center shadow-xl border border-black">
              <h3 className="text-3xl font-black uppercase mb-4 tracking-tighter">Shop Women's</h3>
              <div className="flex flex-col gap-2 text-xs font-bold tracking-widest uppercase">
                <Link href="/shop?category=womens" className="hover:text-gray-500 transition border-b border-gray-200 pb-1">Women's Vintage</Link>
                <Link href="/shop?category=womens" className="hover:text-gray-500 transition border-b border-gray-200 pb-1">Vintage Tops</Link>
                <Link href="/shop?category=womens" className="hover:text-gray-500 transition">Skirts & Trousers</Link>
              </div>
            </div>
          </div>

           {/* Outlet Column */}
           <div className="relative h-[650px] group overflow-hidden border border-transparent hover:border-black transition-colors duration-300">
             <img 
              src="https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=800&q=80"
              alt="Shop Outlet"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[85%] bg-white p-6 text-center shadow-xl border border-black">
              <h3 className="text-3xl font-black uppercase mb-4 tracking-tighter">Shop Outlet</h3>
              <div className="flex flex-col gap-2 text-xs font-bold tracking-widest uppercase">
                <Link href="/shop?category=sale" className="hover:text-gray-500 transition border-b border-gray-200 pb-1">Men's Outlet</Link>
                <Link href="/shop?category=sale" className="hover:text-gray-500 transition border-b border-gray-200 pb-1">Women's Outlet</Link>
                <Link href="/shop?category=kids" className="hover:text-gray-500 transition">Kids Outlet</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: Text Links (Brand Navigation) */}
      <section className="py-16 max-w-[1800px] mx-auto px-4 border-b border-gray-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            {
              title: 'Shop Vintage Nike',
              links: ['Vintage Nike T-Shirts', 'Vintage Nike Jackets', 'Vintage Nike Sweatshirts', 'All Vintage Nike'],
            },
            {
              title: 'Shop Vintage Carhartt',
              links: ['Vintage Carhartt Jackets', 'Vintage Carhartt T-Shirts', 'Vintage Carhartt Sweatshirts', 'All Vintage Carhartt'],
            },
            {
              title: 'Shop Vintage Ralph Lauren',
              links: ['Vintage Ralph Lauren Shirts', 'Vintage Ralph Lauren Polo Shirts', 'Vintage Ralph Lauren 1/4 Zips', 'All Vintage Ralph Lauren'],
            },
            {
              title: 'Shop Vintage Dickies',
              links: ['Vintage Dickies T Shirts', 'Vintage Dickies Jackets', 'Vintage Dickies Workwear Trousers', 'All Vintage Dickies'],
            },
          ].map((column, idx) => (
            <div key={idx}>
              <h3 className="font-black text-xs uppercase tracking-widest mb-6 border-b border-black pb-2 inline-block">{column.title}</h3>
              <ul className="space-y-3 text-[10px] text-gray-500 font-medium uppercase tracking-wide font-mono">
                {column.links.map((link, index) => (
                  <li key={index} className="hover:text-black transition-colors cursor-pointer">
                    <Link href="/shop">{link}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION: Shop Bestsellers (Grid) */}
      <section className="py-16 max-w-[1800px] mx-auto px-4">
        <h2 className="text-3xl font-black uppercase mb-10 tracking-tighter">Shop Bestsellers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { title: 'Vintage Single Stitch T-Shirts', img: 'https://images.unsplash.com/photo-1503341455253-b2e72333dbdb?auto=format&fit=crop&w=800&q=80' },
            { title: 'Vintage Workwear', img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80' },
            { title: 'Vintage Gorpcore & Outdoor Brands', img: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80' },
            { title: 'Vintage Denim & T Shirts', img: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?auto=format&fit=crop&w=800&q=80' },
          ].map((item, idx) => (
            <Link key={idx} href="/shop" className="group block">
              <div className="aspect-square overflow-hidden bg-gray-100 mb-3 border border-transparent group-hover:border-black transition-all duration-300">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <p className="uppercase text-xs tracking-widest font-bold font-mono group-hover:text-gray-600">{item.title} &rarr;</p>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION: Shop by Style (Text Links) */}
      <section className="py-12 max-w-[1800px] mx-auto px-4 border-t border-gray-100">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
          {[
            { title: 'Shop by Style', links: ['Vintage Festival', 'Vintage Blokecore', 'Vintage Y2K', 'Premium Vintage'] },
            { title: 'Vintage Sweatshirts', links: ['Nike Sweatshirts', 'Carhartt Sweatshirts', 'Champion Sweatshirts', 'All Sweatshirts'] },
            { title: 'Vintage Tops & T-Shirts', links: ['Vintage Single Stitch T Shirts', 'Vintage Band T-Shirts', 'Harley Davidson T-Shirts', 'Vintage Polo Shirts'] },
            { title: 'Vintage Jeans & Trousers', links: ['Vintage Levis 501s', 'Vintage Carhartt Jeans & Trousers', 'Vintage Men\'s Designer Trousers', 'Vintage Levis Jeans'] },
            { title: 'Shop Bestsellers', links: ['Vintage Designer', 'Vintage Workwear', 'Vintage Skater', 'Vintage Nascar'] },
          ].map((column, idx) => (
            <div key={idx}>
              <h3 className="uppercase font-black text-xs tracking-wide mb-4 border-b-2 border-gray-100 pb-2">{column.title}</h3>
              <ul className="space-y-2 text-[10px] uppercase tracking-wide font-mono">
                {column.links.map((link, index) => (
                  <li key={index} className="text-gray-500 hover:text-black transition-colors cursor-pointer">
                    <Link href="/shop">{link}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION: Shop Bestsellers Row 2 */}
      <section className="pb-16 max-w-[1800px] mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { title: 'Vintage Designer', img: 'https://images.unsplash.com/photo-1503341455253-b2e72333dbdb?auto=format&fit=crop&w=800&q=80' },
            { title: 'Vintage Workwear', img: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80' },
            { title: 'Vintage Skater', img: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80' },
            { title: 'Vintage Nascar', img: 'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?auto=format&fit=crop&w=800&q=80' },
          ].map((item, idx) => (
            <Link key={idx} href="/shop" className="group block">
              <div className="aspect-square overflow-hidden bg-gray-100 mb-3 border border-transparent group-hover:border-black transition-all duration-300">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <p className="uppercase text-xs tracking-widest font-bold font-mono group-hover:text-gray-600">{item.title} &rarr;</p>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION 5: Gold Access (VIP Layout) */}
      <section className="py-20 bg-black text-white border-y border-gray-800">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-block bg-yellow-500 text-black px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-6">
              VIP Access
            </div>
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6 leading-none">
              Roorq Gold
            </h2>
            <p className="text-gray-400 text-lg font-medium mb-10 max-w-md leading-relaxed uppercase tracking-wide font-mono">
              Skip the queue. Get 24-hour early access to every drop. Never miss your size again.
            </p>
            <Link 
              href="/membership" 
              className="inline-flex items-center gap-3 bg-white text-black px-10 py-5 text-sm font-black uppercase tracking-widest hover:bg-yellow-500 hover:border-yellow-500 transition-all duration-300 border-2 border-transparent rounded-none"
            >
              Join Gold <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex-1 w-full max-w-md bg-zinc-900 p-10 border border-zinc-800 text-center">
             <Clock className="w-16 h-16 mx-auto mb-8 text-yellow-500" />
             <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Tuesday 8 AM</h3>
             <p className="text-sm text-gray-500 uppercase tracking-widest mb-8 font-mono">Early Access Window Opens</p>
             <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
               <div className="w-3/4 h-full bg-yellow-500"></div>
             </div>
             <p className="text-[10px] text-right text-gray-600 mt-2 uppercase font-bold font-mono">Limited Spots Available</p>
          </div>
        </div>
      </section>

      {/* SECTION 6: Referral Magic (Restored) */}
      <section className="py-20 bg-black text-white overflow-hidden relative">
        {/* Abstract bg shape */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-zinc-900 to-transparent opacity-50 transform skew-x-12"></div>
        
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block bg-white text-black px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-6">
                Zero-Cost Growth
              </span>
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6 leading-none">
                Refer a Friend<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-600">
                  Get It Free.
                </span>
              </h2>
              <p className="text-gray-400 text-lg font-medium mb-10 max-w-md leading-relaxed">
                Refer a friend — when they buy their first order, you get the same-category item free.
              </p>
              <Link 
                href="/referrals" 
                className="inline-flex items-center gap-3 bg-white text-black px-10 py-5 text-sm font-black uppercase tracking-widest hover:bg-gray-200 transition"
              >
                Generate Referral Link <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { item: 'Sweater', icon: '🧥' },
                { item: 'Jacket', icon: '👕' },
                { item: 'Shoes', icon: '👟' },
              ].map((ex, idx) => (
                <div key={idx} className="bg-zinc-900 border border-zinc-800 p-6 flex flex-col justify-between h-48 hover:border-white transition duration-300">
                  <div className="text-3xl">{ex.icon}</div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Scenario {idx + 1}</p>
                    <p className="text-sm font-bold uppercase leading-tight">
                      Friend buys {ex.item} <br />
                      <span className="text-green-400">→ You get {ex.item} Free</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: Why We're Different (Visual Upgrade - Image Cards) */}
      <section className="py-20 bg-white border-y border-gray-200">
        <div className="max-w-[1800px] mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1 - Brand New */}
            <div className="relative h-[500px] group overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1548883354-94bcfe321cbb?q=80&w=2070&auto=format&fit=crop" 
                alt="Brand New Only"
                className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-100 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500"></div>
              <div className="absolute bottom-0 left-0 w-full p-10 text-white border-t border-white/20 backdrop-blur-sm bg-black/30">
                <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 leading-none">Brand New<br/>Only</h3>
                <p className="text-xs font-mono uppercase tracking-widest text-gray-300 mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-4 group-hover:translate-y-0">
                  Direct factory surplus. No used clothes. No thrift roulette.
                </p>
                <div className="w-12 h-1 bg-white"></div>
              </div>
            </div>

            {/* Card 2 - Lowest Price */}
            <div className="relative h-[500px] group overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1556906781-9a412961c28c?q=80&w=2070&auto=format&fit=crop" 
                alt="Lowest Campus Price"
                className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-100 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500"></div>
              <div className="absolute bottom-0 left-0 w-full p-10 text-white border-t border-white/20 backdrop-blur-sm bg-black/30">
                <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 leading-none">Lowest Campus<br/>Price</h3>
                <p className="text-xs font-mono uppercase tracking-widest text-gray-300 mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-4 group-hover:translate-y-0">
                  30-50% cheaper than market. Cutting middlemen for you.
                </p>
                <div className="w-12 h-1 bg-white"></div>
              </div>
            </div>

            {/* Card 3 - IITR Exclusive */}
            <div className="relative h-[500px] group overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop" 
                alt="Campus Exclusive"
                className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-100 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500"></div>
              <div className="absolute bottom-0 left-0 w-full p-10 text-white border-t border-white/20 backdrop-blur-sm bg-black/30">
                <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 leading-none">Campus<br/>Exclusive</h3>
                <p className="text-xs font-mono uppercase tracking-widest text-gray-300 mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-4 group-hover:translate-y-0">
                  Built for Roorq. Verified by email. Delivered to your Bhawan.
                </p>
                <div className="w-12 h-1 bg-white"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: Community Strip */}
      <CommunityStrip />

      {/* SECTION 9: Shop Sale Banner */}
      <section className="relative h-[400px] flex items-center justify-center overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=2070&auto=format&fit=crop"
          alt="Shop Sale"
          className="absolute inset-0 w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
        />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 text-center">
          <h2 className="text-7xl md:text-[10rem] font-black uppercase text-red-600 tracking-tighter drop-shadow-xl mb-4 leading-none mix-blend-hard-light">
            Shop Sale
          </h2>
          <div className="bg-white inline-block px-8 py-3 transform -rotate-2 mb-10 shadow-2xl border-2 border-black">
             <p className="text-black font-black uppercase tracking-[0.2em] text-sm">Holiday Sale Live Now</p>
          </div>
          <div>
            <Link 
              href="/shop?category=sale" 
              className="bg-white text-black px-12 py-5 text-sm font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all duration-300 rounded-none border-2 border-transparent hover:border-white"
            >
              Shop Now &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 10: FAQ */}
      <FAQ />

      {/* Sticky Mobile Footer CTA */}
      {isDropLive && (
        <div className="fixed bottom-0 left-0 w-full bg-red-600 p-4 md:hidden z-50 animate-in slide-in-from-bottom">
          <Link 
            href="/shop" 
            className="block w-full bg-white text-red-600 text-center py-3 font-black uppercase tracking-widest text-sm rounded-none"
          >
            Shop Drop — Live
          </Link>
        </div>
      )}

      {/* SECTION 11: Footer */}
      <Footer />
    </div>
  );
}
