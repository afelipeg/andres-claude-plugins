import { Html, Body, Container, Text, Hr, Preview, Head, Section } from '@react-email/components';
import * as React from 'react';

interface Props {
  agencyName: string;
  month: string;
  extraRunsGranted: number;
}

export function QuotaRequestApproved({ agencyName, month, extraRunsGranted }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Extra runs approved — {String(extraRunsGranted)} runs added</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Plinth</Text>
          </Section>
          <Text style={heading}>Extra Runs Approved</Text>
          <Text style={text}>Your request for additional pipeline runs has been approved.</Text>
          <Section style={table}>
            <Text style={row}><strong>Agency:</strong> {agencyName}</Text>
            <Text style={row}><strong>Month:</strong> {month}</Text>
            <Text style={row}><strong>Extra runs added:</strong> {String(extraRunsGranted)}</Text>
          </Section>
          <Text style={text}>The additional runs are available immediately. Check your Usage &amp; Limits in Settings for updated quotas.</Text>
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
const heading = { fontSize: '20px', fontWeight: '600' as const, color: '#0F172A', marginBottom: '16px' };
const text = { fontSize: '14px', color: '#374151', lineHeight: '24px' };
const table = { backgroundColor: '#ECFDF5', borderRadius: '6px', padding: '16px' };
const row = { fontSize: '14px', lineHeight: '28px', color: '#374151', margin: '0' };
const hr = { borderColor: '#E5E7EB', marginTop: '24px', marginBottom: '24px' };
const footer = { fontSize: '12px', color: '#9CA3AF' };
