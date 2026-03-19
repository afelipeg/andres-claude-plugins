import {
  Html, Body, Container, Text, Hr, Preview, Head, Section,
} from '@react-email/components';
import * as React from 'react';

interface Props {
  company: string;
  contactName: string;
  email: string;
  monthlySpend: string;
  platforms: string[];
}

export function DemoRequest({ company, contactName, email, monthlySpend, platforms }: Props) {
  return (
    <Html>
      <Head />
      <Preview>New demo request from {company}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Plinth</Text>
          </Section>
          <Text style={heading}>New Demo Request</Text>
          <Section style={table}>
            <Text style={row}><strong>Company:</strong> {company}</Text>
            <Text style={row}><strong>Contact:</strong> {contactName}</Text>
            <Text style={row}><strong>Email:</strong> {email}</Text>
            <Text style={row}><strong>Monthly Spend:</strong> {monthlySpend || 'Not specified'}</Text>
            <Text style={row}><strong>Platforms:</strong> {platforms.length > 0 ? platforms.join(', ') : 'None selected'}</Text>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Reply directly to this email to respond to {contactName} at {email}.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#f6f9fc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };
const container = { backgroundColor: '#ffffff', margin: '0 auto', padding: '40px 20px', maxWidth: '560px', borderRadius: '8px' };
const header = { backgroundColor: '#0F172A', padding: '20px', borderRadius: '8px 8px 0 0', marginBottom: '24px', marginTop: '-40px', marginLeft: '-20px', marginRight: '-20px' };
const logo = { color: '#ffffff', fontSize: '24px', fontWeight: '700' as const, margin: '0', textAlign: 'center' as const };
const heading = { fontSize: '20px', fontWeight: '600' as const, color: '#0F172A', marginBottom: '16px' };
const table = { backgroundColor: '#F9FAFB', borderRadius: '6px', padding: '16px' };
const row = { fontSize: '14px', lineHeight: '28px', color: '#374151', margin: '0' };
const hr = { borderColor: '#E5E7EB', marginTop: '24px', marginBottom: '24px' };
const footer = { fontSize: '12px', color: '#9CA3AF' };
