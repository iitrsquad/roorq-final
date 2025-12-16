// PHASE 1: COD Only - Razorpay verification route commented out
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// import crypto from 'crypto'

/**
 * POST /api/payment/verify
 * Verifies Razorpay payment signature and updates order status
 * 
 * PHASE 1: COD Only - UPI payment verification disabled
 */
export async function POST(req: NextRequest) {
  // PHASE 1: COD Only - UPI payment verification disabled
  return NextResponse.json(
    { error: 'UPI payment is disabled. Please use Cash on Delivery (COD).' },
    { status: 403 }
  );

  /* PHASE 1: COD Only - Rest of Razorpay verification code commented out
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please login to verify payment' }, 
        { status: 401 }
      )
    }

    // Parse request body
    const body = await req.json()
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId // Internal database order ID
    } = body

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'Payment verification data incomplete' },
        { status: 400 }
      )
    }

    // Verify Razorpay signature
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET
    
    if (!razorpaySecret) {
      console.error('RAZORPAY_KEY_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const generatedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (generatedSignature !== razorpay_signature) {
      console.error('Signature mismatch:', { 
        expected: generatedSignature.substring(0, 10) + '...', 
        received: razorpay_signature.substring(0, 10) + '...' 
      })
      return NextResponse.json(
        { error: 'Invalid signature', message: 'Payment verification failed' },
        { status: 400 }
      )
    }

    // Verify order belongs to user
    const { data: order, error: orderFetchError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, payment_status')
      .eq('id', orderId)
      .single()

    if (orderFetchError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Order does not belong to user' },
        { status: 403 }
      )
    }

    // Check if already paid (idempotency)
    if (order.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        message: 'Payment already verified',
        orderId
      })
    }

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        amount: order.total_amount,
        method: 'upi',
        transaction_id: razorpay_payment_id,
        status: 'completed'
      })

    if (paymentError) {
      console.error('Payment record creation failed:', paymentError)
      // Continue anyway - order update is more important
    }

    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'placed', // Move from 'reserved' to 'placed'
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (orderError) {
      console.error('Order update failed:', orderError)
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: 500 }
      )
    }

    // Check if this is user's first completed order - unlock UPI for future
    const { count: orderCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('payment_status', 'paid')

    // If this is the first paid order, mark first_cod_done (enables UPI for next time)
    // Note: first_cod_done is a bit of a misnomer - it really means "first order completed"
    if (orderCount === 1) {
      await supabase
        .from('users')
        .update({ first_cod_done: true })
        .eq('id', user.id)
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      orderId
    })

  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Payment verification failed' },
      { status: 500 }
    )
  }
  } */
}

