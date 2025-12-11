// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const signature = req.headers.get('x-razorpay-signature');
    const body = await req.text();

    if (!signature || !RAZORPAY_WEBHOOK_SECRET) {
      return new Response('Missing signature or secret', { status: 400 });
    }

    // Verify Signature
    const verified = await verifySignature(body, signature, RAZORPAY_WEBHOOK_SECRET);
    if (!verified) {
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);
    const { payload } = event;

    // Handle payment.captured or order.paid
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = payload.payment.entity;
      const orderId = payment.notes.orderId; // We passed this in notes
      const transactionId = payment.id;
      const amount = payment.amount / 100; // Convert from paisa
      const method = payment.method;

      if (!orderId) {
         console.error('No orderId in payment notes');
         return new Response('No orderId in notes', { status: 400 });
      }

      // CALL ATOMIC DB FUNCTION
      const { data: result, error: rpcError } = await supabase
        .rpc('process_payment_success', {
          p_order_id: orderId,
          p_transaction_id: transactionId,
          p_amount: amount,
          p_method: method
        });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw rpcError;
      }
      
      console.log('Payment processed:', result);

      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  
  // Signature from header is Hex, we need Uint8Array
  const signatureBytes = hexToUint8Array(signature);
  const bodyData = enc.encode(body);
  
  return await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    bodyData
  );
}

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
      throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
