import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { render } from "npm:@react-email/render@0.0.10";
import { logger } from "../_shared/logger.ts";

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

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

type UserRecord = {
  id: string;
  email: string;
  full_name: string | null;
  referral_code: string | null;
};

type OrderRecord = {
  id: string;
  user_id: string;
  order_number: string;
  total_amount: number;
  delivery_hostel: string | null;
  delivery_room: string | null;
  status: string;
};

type ReferralRewardRecord = {
  id: string;
  user_id: string;
  category: string;
};

type OrderItemRow = {
  quantity: number;
  price: number;
  products: { name: string | null } | null;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    
    // Payload structure depends on the Database Webhook or manual call
    // We expect: { type: 'WELCOME' | 'ORDER_CONFIRMATION' | 'STATUS_UPDATE' | 'REFERRAL', data: ... }
    // OR if triggered by Supabase DB Webhook, it wraps the record in { type: 'INSERT', table: '...', record: ... }
    
    let type = payload.type;
    let data = payload.record ?? payload.data;
    
    // Normalize DB Webhook Payload
    if (payload.table) {
      if (payload.table === 'users' && payload.type === 'INSERT') type = 'WELCOME';
      if (payload.table === 'orders' && payload.type === 'INSERT') type = 'ORDER_CONFIRMATION';
      if (payload.table === 'orders' && payload.type === 'UPDATE') {
         // Only trigger if status changed
         const oldStatus = (payload.old_record as { status?: string } | undefined)?.status;
         const newStatus = (payload.record as { status?: string } | undefined)?.status;
         if (oldStatus !== newStatus) {
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

    if (!data) {
      return new Response("Missing data", { status: 400 });
    }

    logger.info("Processing event", { type });

    let emailHtml: string | null = null;
    let subject: string | null = null;
    let to: string | null = null;

    switch (type) {
      case 'WELCOME':
        // data is User record
        const user = data as UserRecord;
        subject = "Welcome to the Underground";
        to = user.email;
        emailHtml = await render(
          <WelcomeEmail 
            name={user.full_name?.split(' ')[0]} 
            referralCode={user.referral_code} 
          />
        );
        break;

      case 'ORDER_CONFIRMATION':
        // data is Order record. We need to fetch items and user email.
        const order = data as OrderRecord;
        const { data: orderItems } = await supabase
           .from('order_items')
           .select('quantity, price, products(name)')
           .eq('order_id', order.id);
        
        const { data: orderUser } = await supabase
           .from('users')
           .select('email')
           .eq('id', order.user_id)
           .single();
        
        if (!orderUser?.email) throw new Error("User not found for order");

        subject = `Order Confirmed: ${order.order_number}`;
        to = orderUser.email;
        
        const items = ((orderItems as OrderItemRow[] | null) ?? []).map((item) => ({
          name: item.products?.name ?? 'Item',
          quantity: item.quantity,
          price: item.price,
        }));

        emailHtml = await render(
          <OrderConfirmationEmail 
             orderNumber={order.order_number}
             totalAmount={order.total_amount}
             items={items}
             hostel={order.delivery_hostel}
             room={order.delivery_room}
          />
        );
        break;

      case 'STATUS_UPDATE':
        // data is Order record
        const statusOrder = data as OrderRecord;
        const { data: statusUser } = await supabase
           .from('users')
           .select('email')
           .eq('id', statusOrder.user_id)
           .single();

        if (!statusUser?.email) throw new Error("User not found");
        
        to = statusUser.email;
        subject = `Order Update: ${statusOrder.order_number}`;
        emailHtml = await render(
           <OrderStatusEmail 
             orderNumber={statusOrder.order_number}
             status={statusOrder.status}
           />
        );
        break;

      case 'REFERRAL':
         // data is referral_rewards record
         const reward = data as ReferralRewardRecord;
         const { data: rewardUser } = await supabase
            .from('users')
            .select('email, full_name')
            .eq('id', reward.user_id)
            .single();
            
         // Fetch referral details if needed
         
         if (!rewardUser?.email) throw new Error("User not found");

         to = rewardUser.email;
         subject = "You earned free gear";
         emailHtml = await render(
            <ReferralRewardEmail 
               referrerName={rewardUser.full_name || 'Friend'}
               friendName="Your friend" // simplified
               reward={reward.category}
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
            logger.error('Resend Error', { error });
            return new Response(
              JSON.stringify({ error: getErrorMessage(error, 'Resend failed') }),
              { status: 500 }
            );
        }
        
        return new Response(JSON.stringify(emailData), { status: 200, headers: { 'Content-Type': 'application/json' }});
    }

    return new Response("No email sent", { status: 200 });

  } catch (error: unknown) {
    logger.error('Notify Error', { error });
    return new Response(
      JSON.stringify({ error: getErrorMessage(error, 'Notification failed') }),
      { status: 500, headers: { 'Content-Type': 'application/json' }}
    );
  }
});
