import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { render } from "npm:@react-email/render@0.0.10";

// Import Templates
import WelcomeEmail from "./emails/WelcomeEmail.tsx";
import OrderConfirmationEmail from "./emails/OrderConfirmationEmail.tsx";
import OrderStatusEmail from "./emails/OrderStatusEmail.tsx";
import ReferralRewardEmail from "./emails/ReferralRewardEmail.tsx";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const resend = new Resend(RESEND_API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FROM_EMAIL = "Roorq <updates@roorq.com>"; // Ensure this domain is verified in Resend

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    
    // Payload structure depends on the Database Webhook or manual call
    // We expect: { type: 'WELCOME' | 'ORDER_CONFIRMATION' | 'STATUS_UPDATE' | 'REFERRAL', data: ... }
    // OR if triggered by Supabase DB Webhook, it wraps the record in { type: 'INSERT', table: '...', record: ... }
    
    let type = payload.type;
    let data = payload.record || payload.data;
    
    // Normalize DB Webhook Payload
    if (payload.table) {
      if (payload.table === 'users' && payload.type === 'INSERT') type = 'WELCOME';
      if (payload.table === 'orders' && payload.type === 'INSERT') type = 'ORDER_CONFIRMATION';
      if (payload.table === 'orders' && payload.type === 'UPDATE') {
         // Only trigger if status changed
         if (payload.old_record.status !== payload.record.status) {
             type = 'STATUS_UPDATE';
         } else {
             return new Response("Status not changed, skipping", { status: 200 });
         }
      }
      if (payload.table === 'referral_rewards' && payload.type === 'INSERT') type = 'REFERRAL';
    }

    if (!type) {
        return new Response("Unknown event type", { status: 200 });
    }

    console.log(`Processing event: ${type}`);

    let emailHtml;
    let subject;
    let to;

    switch (type) {
      case 'WELCOME':
        // data is User record
        subject = "Welcome to the Underground";
        to = data.email;
        emailHtml = await render(
          <WelcomeEmail 
            name={data.full_name?.split(' ')[0]} 
            referralCode={data.referral_code} 
          />
        );
        break;

      case 'ORDER_CONFIRMATION':
        // data is Order record. We need to fetch items and user email.
        const { data: orderItems } = await supabase
           .from('order_items')
           .select('*, products(name)')
           .eq('order_id', data.id);
        
        const { data: orderUser } = await supabase
           .from('users')
           .select('email')
           .eq('id', data.user_id)
           .single();
        
        if (!orderUser) throw new Error("User not found for order");

        subject = `Order Confirmed: ${data.order_number}`;
        to = orderUser.email;
        
        const items = orderItems?.map((item: any) => ({
            name: item.products?.name || 'Item',
            quantity: item.quantity,
            price: item.price
        })) || [];

        emailHtml = await render(
          <OrderConfirmationEmail 
             orderNumber={data.order_number}
             totalAmount={data.total_amount}
             items={items}
             hostel={data.delivery_hostel}
             room={data.delivery_room}
          />
        );
        break;

      case 'STATUS_UPDATE':
        // data is Order record
        const { data: statusUser } = await supabase
           .from('users')
           .select('email')
           .eq('id', data.user_id)
           .single();

        if (!statusUser) throw new Error("User not found");
        
        to = statusUser.email;
        subject = `Order Update: ${data.order_number}`;
        emailHtml = await render(
           <OrderStatusEmail 
             orderNumber={data.order_number}
             status={data.status}
           />
        );
        break;

      case 'REFERRAL':
         // data is referral_rewards record
         const { data: rewardUser } = await supabase
            .from('users')
            .select('email, full_name')
            .eq('id', data.user_id)
            .single();
            
         // Fetch referral details if needed
         
         if (!rewardUser) throw new Error("User not found");

         to = rewardUser.email;
         subject = "You earned free gear";
         emailHtml = await render(
            <ReferralRewardEmail 
               referrerName={rewardUser.full_name || 'Friend'}
               friendName="Your friend" // simplified
               reward={data.category}
            />
         );
         break;

      default:
        return new Response("Unhandled Type", { status: 200 });
    }

    // Send Email
    if (to && emailHtml) {
        const { data: emailData, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [to],
            subject: subject,
            html: emailHtml,
        });

        if (error) {
            console.error('Resend Error:', error);
            return new Response(JSON.stringify({ error }), { status: 500 });
        }
        
        return new Response(JSON.stringify(emailData), { status: 200, headers: { 'Content-Type': 'application/json' }});
    }

    return new Response("No email sent", { status: 200 });

  } catch (error: any) {
    console.error('Notify Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
});
