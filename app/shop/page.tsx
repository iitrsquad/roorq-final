import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import StructuredData from '@/components/StructuredData';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbSchema, collectionSchema } from '@/lib/seo/schema';
import { Filter, ChevronDown } from 'lucide-react';
import { logger } from '@/lib/logger';

export const metadata = buildMetadata({
  title: 'Shop',
  description: 'Shop the latest weekly drops and vintage pieces curated for IIT Roorkee.',
  path: '/shop',
  keywords: ['shop', 'weekly drops', 'vintage', 'IIT Roorkee'],
});

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; sort?: string; gender?: string; tag?: string };
}) {
  const supabase = await createClient();
  
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true);

  // Apply filters
  if (searchParams.category) {
    query = query.eq('category', searchParams.category);
  }

  if (searchParams.gender) {
    // Now safe to filter by gender since column exists
    query = query.eq('gender', searchParams.gender);
  }

  if (searchParams.search) {
    query = query.or(`name.ilike.%${searchParams.search}%,description.ilike.%${searchParams.search}%,brand.ilike.%${searchParams.search}%`);
  }

  // Sorting
  switch (searchParams.sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'bestsellers':
      query = query.order('created_at', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data: products, error } = await query;

  if (error) {
    logger.error('Error fetching products', error instanceof Error ? error : undefined);
    // Graceful fallback: Show empty state instead of crashing
  }

  const categories = [
    { name: 'All', value: '' },
    { name: 'Jackets', value: 'jacket' },
    { name: 'Sweaters', value: 'sweater' },
    { name: 'T-Shirts', value: 't-shirt' },
    { name: 'Jeans', value: 'jeans' },
    { name: 'Trousers', value: 'trousers' },
    { name: 'Shoes', value: 'shoes' },
    { name: 'Accessories', value: 'accessories' },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <StructuredData
        data={[
          collectionSchema({
            title: 'Roorq Shop',
            description: 'Weekly drops and vintage fashion curated for IIT Roorkee.',
            path: '/shop',
          }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Shop', path: '/shop' },
          ]),
        ]}
      />
      <Navbar />
      
      {/* Header / Banner */}
      <div className="bg-gray-100 py-12 px-4 text-center border-b border-gray-200">
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4">
          {searchParams.gender ? `${searchParams.gender}'s` : ''} {searchParams.category || 'All Vintage'}
        </h1>
        <p className="text-gray-500 font-mono uppercase tracking-widest text-xs md:text-sm max-w-2xl mx-auto">
          {products?.length || 0} Items Found • 100% Authentic • Cleaned & Ready to Wear
        </p>
      </div>

      <div className="flex-1 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-gray-100 pb-4 sticky top-20 bg-white z-30 py-4">
          
          {/* Categories (Desktop) */}
          <div className="hidden md:flex flex-wrap gap-2">
            {categories.map((cat) => (
              <a
                key={cat.value}
                href={`/shop?${new URLSearchParams({ ...searchParams, category: cat.value }).toString()}`}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border ${
                  searchParams.category === cat.value || (!searchParams.category && cat.value === '')
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-gray-200 hover:border-black'
                } transition-colors`}
              >
                {cat.name}
              </a>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative group w-full md:w-48">
              <button className="w-full flex justify-between items-center px-4 py-2 border border-black bg-white text-xs font-bold uppercase tracking-wide">
                <span>Sort By</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 w-full bg-white border border-black border-t-0 hidden group-hover:block z-40">
                {[
                  { label: 'Newest Arrivals', value: 'newest' },
                  { label: 'Price: Low to High', value: 'price_asc' },
                  { label: 'Price: High to Low', value: 'price_desc' },
                ].map((option) => (
                  <a
                    key={option.value}
                    href={`/shop?${new URLSearchParams({ ...searchParams, sort: option.value }).toString()}`}
                    className="block px-4 py-2 text-xs font-bold uppercase hover:bg-gray-100"
                  >
                    {option.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Categories (Scrollable) */}
        <div className="md:hidden flex overflow-x-auto gap-2 mb-8 pb-2 no-scrollbar">
           {categories.map((cat) => (
              <a
                key={cat.value}
                href={`/shop?${new URLSearchParams({ ...searchParams, category: cat.value }).toString()}`}
                className={`flex-shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wide border ${
                  searchParams.category === cat.value || (!searchParams.category && cat.value === '')
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-gray-200'
                }`}
              >
                {cat.name}
              </a>
            ))}
        </div>

        {/* Products Grid */}
        {products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-8 gap-x-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Filter className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-xl font-black uppercase tracking-widest text-gray-400">No products found</h3>
            <p className="mt-2 text-gray-500 font-mono text-sm max-w-md">
              {error ? 'There was a problem loading products.' : "We couldn't find any items matching your filters."}
            </p>
            <a href="/shop" className="mt-6 inline-block bg-black text-white px-8 py-3 text-xs font-bold uppercase tracking-widest">
              Clear All Filters
            </a>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
