import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import AddToCartButton from '@/components/AddToCartButton';
import { notFound } from 'next/navigation';
import { Check, ShieldCheck, Truck, RefreshCcw, Ruler } from 'lucide-react';

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .eq('is_active', true)
    .single();

  if (!product) {
    notFound();
  }

  const savings = product.retail_price 
    ? Math.round(((product.retail_price - product.price) / product.retail_price) * 100)
    : 0;

  const availableStock = product.stock_quantity - product.reserved_quantity;

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white">
      <Navbar />
      
      <div className="flex-1 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Breadcrumb */}
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-8">
          <a href="/" className="hover:text-black">Home</a> / <a href="/shop" className="hover:text-black">Shop</a> / <span className="text-black">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
          {/* Product Images - Gallery Style */}
          <div className="space-y-4">
            {product.images && product.images.length > 0 ? (
              <>
                <div className="relative aspect-[3/4] bg-gray-50 border border-gray-100 overflow-hidden group">
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                  {/* Badge */}
                  <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 text-xs font-black uppercase tracking-widest">
                    Vintage
                  </div>
                </div>
                {product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-4">
                    {product.images.map((img: string, idx: number) => (
                      <div key={idx} className="relative aspect-square bg-gray-50 border border-gray-100 cursor-pointer hover:border-black transition-colors">
                        <Image
                          src={img}
                          alt={`${product.name} ${idx + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 25vw, 12.5vw"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center text-gray-400 font-mono text-sm uppercase tracking-widest">
                No Image Available
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <div className="border-b border-gray-100 pb-8 mb-8">
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4 leading-none">
                {product.name}
              </h1>
              
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-4">
                    <span className="text-3xl font-black tracking-tight">₹{product.price.toFixed(0)}</span>
                    {product.retail_price && product.retail_price > product.price && (
                      <div className="flex items-center gap-2">
                        <span className="text-xl text-gray-400 line-through decoration-1">
                          ₹{product.retail_price.toFixed(0)}
                        </span>
                        <span className="bg-red-600 text-white px-2 py-0.5 text-xs font-black uppercase tracking-widest">
                          -{savings}%
                        </span>
                      </div>
                    )}
                 </div>
                 {/* Brand Badge */}
                 {product.brand && (
                   <span className="border border-black px-3 py-1 text-xs font-bold uppercase tracking-widest">
                     {product.brand}
                   </span>
                 )}
              </div>

              {/* Size Display */}
              <div className="bg-gray-50 p-6 border border-gray-100 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold uppercase tracking-widest">Size</span>
                  <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide underline text-gray-500 hover:text-black">
                    <Ruler className="w-3 h-3" /> Size Guide
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 flex items-center justify-center bg-black text-white text-lg font-bold border-2 border-black">
                    {product.size}
                  </div>
                  <span className="text-xs text-gray-500 font-mono uppercase">
                    Single Item in Stock
                  </span>
                </div>
              </div>

              {/* Add to Cart */}
              <div className="mb-8">
                <AddToCartButton 
                  productId={product.id} 
                  disabled={availableStock === 0}
                />
                {availableStock === 0 && (
                   <p className="mt-2 text-red-600 text-xs font-bold uppercase tracking-widest text-center">
                     Sold Out
                   </p>
                )}
              </div>

              {/* Trust Indicators */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest mb-1">Authentic</h4>
                    <p className="text-[10px] text-gray-500 leading-relaxed">Verified by our experts for authenticity and quality.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest mb-1">24h Delivery</h4>
                    <p className="text-[10px] text-gray-500 leading-relaxed">Direct to your hostel within 24 hours.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RefreshCcw className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest mb-1">Cleaned</h4>
                    <p className="text-[10px] text-gray-500 leading-relaxed">Professionally laundered and ready to wear.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest mb-1">Easy Returns</h4>
                    <p className="text-[10px] text-gray-500 leading-relaxed">Hassle-free returns within 48 hours.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="prose prose-sm max-w-none">
              <h3 className="text-sm font-black uppercase tracking-widest mb-4">Description</h3>
              <p className="text-gray-600 leading-relaxed font-mono text-xs">
                {product.description || "No description available for this item."}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs font-mono uppercase text-gray-500">
                <div><span className="font-bold text-black">Material:</span> {product.material || 'N/A'}</div>
                <div><span className="font-bold text-black">Color:</span> {product.color || 'N/A'}</div>
                <div><span className="font-bold text-black">Category:</span> {product.category}</div>
                <div><span className="font-bold text-black">Condition:</span> Excellent Vintage</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
