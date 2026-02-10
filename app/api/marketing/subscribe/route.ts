import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { serverEnv } from '@/lib/env.server';

export const runtime = 'nodejs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SubscribePayload = {
  email?: string;
  interests?: string[];
  brands?: string[];
};

function getMailchimpConfig() {
  const apiKey = serverEnv.MAILCHIMP_API_KEY;
  const audienceId = serverEnv.MAILCHIMP_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    return null;
  }

  const dc = apiKey.split('-')[1];
  if (!dc) {
    return null;
  }

  return { apiKey, audienceId, dc };
}

function buildTags(interests: string[], brands: string[]) {
  const tags: { name: string; status: 'active' }[] = [];

  interests.forEach((value) => {
    tags.push({ name: `interest:${value}`, status: 'active' });
  });

  brands.forEach((value) => {
    tags.push({ name: `brand:${value}`, status: 'active' });
  });

  return tags;
}

export async function POST(request: NextRequest) {
  const config = getMailchimpConfig();

  if (!config) {
    return NextResponse.json(
      { error: 'Mailchimp is not configured.' },
      { status: 500 }
    );
  }

  const { apiKey, audienceId, dc } = config;

  let payload: SubscribePayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 });
  }

  const interests = Array.isArray(payload.interests) ? payload.interests : [];
  const brands = Array.isArray(payload.brands) ? payload.brands : [];

  const subscriberHash = crypto
    .createHash('md5')
    .update(email)
    .digest('hex');

  const status = serverEnv.MAILCHIMP_DOUBLE_OPT_IN ? 'pending' : 'subscribed';

  const authHeader = Buffer.from(`roorq:${apiKey}`).toString('base64');
  const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

  const upsertResponse = await fetch(
    `${baseUrl}/lists/${audienceId}/members/${subscriberHash}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status_if_new: status,
        status,
      }),
    }
  );

  const upsertPayload = await upsertResponse.json();
  if (!upsertResponse.ok) {
    return NextResponse.json(
      { error: upsertPayload?.detail || 'Mailchimp signup failed.' },
      { status: upsertResponse.status }
    );
  }

  const tags = buildTags(interests, brands);
  if (tags.length > 0) {
    const tagResponse = await fetch(
      `${baseUrl}/lists/${audienceId}/members/${subscriberHash}/tags`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags }),
      }
    );

    if (!tagResponse.ok) {
      const tagPayload = await tagResponse.json();
      return NextResponse.json(
        { error: tagPayload?.detail || 'Signup succeeded but tags failed.' },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
