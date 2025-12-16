// PHASE 1: COD Only - Razorpay API route commented out
import { NextResponse } from 'next/server';
// import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';

// // Initialize Razorpay only when keys are available
// const getRazorpay = () => {
//   const keyId = process.env.RAZORPAY_KEY_ID;
//   const keySecret = process.env.RAZORPAY_KEY_SECRET;
//   
//   if (!keyId || !keySecret) {
//     throw new Error('Razorpay credentials not configured');
//   }
//   
//   return new Razorpay({
//     key_id: keyId,
//     key_secret: keySecret,
//   });
// };

export async function POST(req: Request) {
  // PHASE 1: COD Only - UPI payment disabled
  return NextResponse.json(
    { error: 'UPI payment is disabled. Please use Cash on Delivery (COD).' },
    { status: 403 }
  );

  // try {
  //   const supabase = await createClient();
  //   const { data: { user } } = await supabase.auth.getUser();

  //   if (!user) {
  //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  //   }

  //   const { amount, orderId } = await req.json();

  //   if (!amount || !orderId) {
  //     return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  //   }

  //   // Verify user is eligible for UPI (first_cod_done)
  //   const { data: userProfile } = await supabase
  //     .from('users')
  //     .select('first_cod_done')
  //     .eq('id', user.id)
  //     .single();

  //   if (!userProfile?.first_cod_done) {
  //     return NextResponse.json(
  //       { error: 'UPI payment is locked. Please complete a COD order first.' },
  //       { status: 403 }
  //     );
  //   }

  //   // Create Razorpay order
  //   const options = {
  //     amount: Math.round(amount * 100), // amount in paisa
  //     currency: 'INR',
  //     receipt: orderId,
  //     notes: {
  //       orderId: orderId,
  //       userId: user.id
  //     }
  //   };

  //   const razorpay = getRazorpay();
  //   const order = await razorpay.orders.create(options);

  //   return NextResponse.json(order);
  // } catch (error: any) {
  //   console.error('Razorpay Error:', error);
  //   return NextResponse.json(
  //     { error: error.message || 'Error creating payment order' },
  //     { status: 500 }
  //   );
  // }
}
