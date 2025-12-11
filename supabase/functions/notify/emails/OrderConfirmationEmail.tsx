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

interface OrderConfirmationProps {
  orderNumber: string;
  totalAmount: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  hostel: string;
  room: string;
}

export const OrderConfirmationEmail = ({ orderNumber, totalAmount, items, hostel, room }: OrderConfirmationProps) => (
  <Html>
    <Head />
    <Preview>Order Confirmed: {orderNumber}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Order Confirmed</Heading>
        
        <Text style={text}>
          We've received your order. Delivery is scheduled within 24 hours to {hostel} {room}.
        </Text>

        <Section style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', margin: '20px 0', padding: '20px 0' }}>
          <Text style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Order Summary</Text>
          {items.map((item, i) => (
            <Row key={i} style={{ marginBottom: '10px' }}>
              <Column style={{ width: '70%' }}>
                <Text style={{ margin: 0, fontWeight: 'bold' }}>{item.name}</Text>
                <Text style={{ margin: 0, fontSize: '12px', color: '#666' }}>Qty: {item.quantity}</Text>
              </Column>
              <Column style={{ width: '30%', textAlign: 'right' }}>
                <Text style={{ margin: 0 }}>₹{item.price}</Text>
              </Column>
            </Row>
          ))}
          <Hr style={{ borderColor: '#ddd', margin: '10px 0' }} />
          <Row>
            <Column>
              <Text style={{ margin: 0, fontWeight: '900', textTransform: 'uppercase' }}>Total</Text>
            </Column>
            <Column style={{ textAlign: 'right' }}>
              <Text style={{ margin: 0, fontWeight: '900' }}>₹{totalAmount}</Text>
            </Column>
          </Row>
        </Section>

        <Text style={text}>
          <span style={{ fontWeight: 'bold' }}>Payment:</span> Cash on Delivery / UPI on Delivery
        </Text>

        <Text style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', marginTop: '40px' }}>
          Order #{orderNumber}
        </Text>
      </Container>
    </Body>
  </Html>
);

export default OrderConfirmationEmail;
