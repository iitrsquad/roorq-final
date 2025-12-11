'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  { question: "Can I cancel my order?", answer: "Of course you can cancel your order if you change your mind - you just need to let us know before we dispatch the order." },
  { question: "Can I change the shipping address on my order?", answer: "Yes - as long as we haven't shipped it yet! If you need to change your address, please email us." },
  { question: "Can I add or remove and item from my order?", answer: "We can make changes to an order as long as you let us know before we dispatch the order so we can make the change for you." },
  { question: "When will my order be shipped?", answer: "Please allow a 1-2 working day handling period on orders. We do not ship any orders placed over the weekend or bank holidays." },
  { question: "Can I return my items?", answer: "Our return policy lasts 30 days. If 30 days have gone by since your purchase, unfortunately we can’t offer you a refund or exchange." },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 max-w-4xl mx-auto px-4">
      <h2 className="text-3xl font-black uppercase tracking-tighter text-center mb-12">Frequently Asked Questions</h2>
      
      <div className="flex justify-center gap-8 mb-12 text-xs font-bold uppercase tracking-widest">
        <button className="bg-black text-white px-6 py-2">Orders</button>
        <button className="text-gray-400 hover:text-black transition-colors">Shipping</button>
        <button className="text-gray-400 hover:text-black transition-colors">Returns</button>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <div key={idx} className="border-b border-gray-200">
            <button 
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex justify-between items-center py-4 text-left hover:bg-gray-50 transition px-2"
            >
              <span className="font-bold text-sm uppercase tracking-wide">{faq.question}</span>
              {openIndex === idx ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
            <div 
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                openIndex === idx ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <p className="p-4 text-sm text-gray-600 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

