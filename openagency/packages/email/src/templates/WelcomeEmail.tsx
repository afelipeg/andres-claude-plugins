import {
  Html, Body, Container, Text, Button, Hr, Preview, Head, Section,
} from '@react-email/components';
import * as React from 'react';

interface Props {
  name: string;
  appUrl: string;
}

export function WelcomeEmail({ name, appUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Plinth, {name}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Plinth</Text>
          </Section>
          <Text style={heading}>Welcome to Plinth</Text>
          <Text style={paragraph}>
            Hi <strong>{name}</strong>, your account is ready. You now have access to AI-powered media optimization, waste detection, and outcome-based billing.
          </Text>
          <Section style={btnContainer}>
            <Button style={button} href={appUrl}>
              Go to Plinth
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Plinth by Polanyi</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#f6f9fc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };
const container = { backgroundColor: '#ffffff', margin: '0 auto', padding: '40px 20px', maxWidth: '560px', borderRadius: '8px' };
const header = { backgroundColor: '#0F172A', padding: '20px', borderRadius: '8px 8px 0 0', marginBottom: '24px', marginTop: '-40px', marginLeft: '-20px', marginRight: '-20px' };
const logo = { color: '#ffffff', fontSize: '24px', fontWeight: '700' as const, margin: '0', textAlign: 'center' as const };
const heading = { fontSize: '20px', fontWeight: '600' as const, color: '#0F172A', marginBottom: '8px' };
const paragraph = { fontSize: '14px', lineHeight: '24px', color: '#4B5563' };
const btnContainer = { textAlign: 'center' as const, marginTop: '24px', marginBottom: '24px' };
const button = { backgroundColor: '#0F172A', borderRadius: '6px', color: '#fff', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', padding: '12px 24px', display: 'inline-block' };
const hr = { borderColor: '#E5E7EB', marginTop: '24px', marginBottom: '24px' };
const footer = { fontSize: '12px', color: '#9CA3AF' };
