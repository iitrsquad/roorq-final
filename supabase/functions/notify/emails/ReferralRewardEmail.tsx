import React from 'react';
import {
  Html,
  Body,
  Head,
  Heading,
  Container,
  Text,
  Link,
  Preview,
} from '@react-email/components';

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'HelveticaNeue,Helvetica,Arial,sans-serif',
};

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  border: '2px solid #000',
  padding: '20px',
};

const heading = {
  fontSize: '32px',
  lineHeight: '1.1',
  fontWeight: '900',
  textTransform: 'uppercase' as const,
  letterSpacing: '-1px',
  margin: '20px 0',
};

const text = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333',
  margin: '16px 0',
};

const button = {
  backgroundColor: '#000',
  color: '#fff',
  padding: '16px 24px',
  fontWeight: '900',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  textDecoration: 'none',
  display: 'inline-block',
  marginTop: '10px',
};

interface ReferralRewardProps {
  referrerName: string;
  friendName: string;
  reward: string;
}

export const ReferralRewardEmail = ({ referrerName, friendName, reward }: ReferralRewardProps) => (
  <Html>
    <Head />
    <Preview>You earned a free {reward}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Reward Unlocked</Heading>
        
        <Text style={text}>
          Boom. <strong>{friendName}</strong> just placed their first order.
        </Text>

        <Text style={text}>
          As promised, you've earned a free <strong>{reward}</strong>.
        </Text>
        
        <Text style={text}>
          This has been added to your account rewards. You can claim it on your next order.
        </Text>

        <Link href="https://roorq.com/profile" style={button}>
          View Rewards
        </Link>
      </Container>
    </Body>
  </Html>
);

export default ReferralRewardEmail;
