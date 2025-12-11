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
  Section,
  Row,
  Column,
  Img,
  Hr,
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

interface WelcomeEmailProps {
  name: string;
  referralCode: string;
}

export const WelcomeEmail = ({ name, referralCode }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to the Roorq Underground.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Welcome to Roorq.</Heading>
        
        <Text style={text}>
          Hey {name || 'there'},
        </Text>
        
        <Text style={text}>
          You're in. Roorq is the campus-exclusive drop platform for IIT Roorkee.
          We drop authentic vintage gear every Wednesday.
        </Text>

        <Section style={{ border: '1px solid #000', padding: '20px', margin: '20px 0', backgroundColor: '#f9f9f9' }}>
          <Text style={{ ...text, margin: 0, fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Your Referral Code
          </Text>
          <Text style={{ fontSize: '24px', fontWeight: '900', margin: '10px 0', letterSpacing: '2px' }}>
            {referralCode}
          </Text>
          <Text style={{ fontSize: '14px', color: '#666' }}>
            Share this with friends. When they order, you get free gear.
          </Text>
        </Section>

        <Link href="https://roorq.com/shop" style={button}>
          View Current Drop
        </Link>
        
        <Hr style={{ borderColor: '#e6e6e6', margin: '40px 0' }} />
        <Text style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>
          Roorq.in • IIT Roorkee • F*ck Fast Fashion
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;
