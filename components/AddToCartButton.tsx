'use client';

import { useState } from 'react';
import { ShoppingCart, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface AddToCartButtonProps {
  productId: string;
  disabled?: boolean;
}

export default function AddToCartButton({ productId, disabled }: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleAddToCart = async () => {
    if (disabled || loading) return;

    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please sign in to add items to cart');
        router.push('/auth?redirect=/products/' + productId);
        return;
      }

      // Get cart from localStorage or create new
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      
      // Check if product already in cart
      const existingItem = cart.find((item: any) => item.productId === productId);
      
      if (existingItem) {
        existingItem.quantity += 1;
        toast.success('Updated quantity in cart');
      } else {
        cart.push({ productId, quantity: 1 });
        toast.success('Added to cart!');
      }
      
      localStorage.setItem('cart', JSON.stringify(cart));
      
      // Dispatch custom event to update cart count in Navbar
      window.dispatchEvent(new Event('cartUpdated'));
      
      // Show success animation
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      
      // Removed router.refresh() - it causes unnecessary re-renders and can break sessions
      // The cart state is in localStorage, so no refresh needed
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={disabled || loading}
      className={`w-full py-4 px-6 font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
        disabled
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : added
          ? 'bg-green-600 text-white'
          : loading
          ? 'bg-gray-800 text-white cursor-wait'
          : 'bg-black text-white hover:bg-gray-800 active:scale-[0.98]'
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Adding...
        </>
      ) : added ? (
        <>
          <Check className="w-5 h-5" />
          Added!
        </>
      ) : disabled ? (
        'Out of Stock'
      ) : (
        <>
          <ShoppingCart className="w-5 h-5" />
          Add to Cart
        </>
      )}
    </button>
  );
}
