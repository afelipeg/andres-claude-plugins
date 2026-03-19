import { Html, Body, Container, Text, Hr, Preview, Head, Section, Button } from '@react-email/components';
import * as React from 'react';

interface Props {
  agencyName: string;
  month: string;
  extraRunsRequested: number;
  reason: string;
  appUrl: string;
}

export function QuotaRequestReceived({ agencyName, month, extraRunsRequested, reason, appUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Run quota request from {agencyName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Plinth</Text>
          </Section>
          <Text style={heading}>Quota Request</Text>
          <Text style={text}><strong>{agencyName}</strong> is requesting additional pipeline runs.</Text>
          <Section style={table}>
            <Text style={row}><strong>Month:</strong> {month}</Text>
            <Text style={row}><strong>Extra runs requested:</strong> {extraRunsRequested}</Text>
            <Text style={row}><strong>Reason:</strong> {reason}</Text>
          </Section>
          <Section style={{ textAlign: 'center' as const, marginTop: '24px' }}>
            <Button href={`${appUrl}/app/admin`} style={btn}>
              Review Request
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Go to Super Admin &gt; Quotas tab to approve or deny this request.</Text>
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
const table = { backgroundColor: '#F9FAFB', borderRadius: '6px', padding: '16px' };
const row = { fontSize: '14px', lineHeight: '28px', color: '#374151', margin: '0' };
const btn = { backgroundColor: '#02c98d', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none' };
const hr = { borderColor: '#E5E7EB', marginTop: '24px', marginBottom: '24px' };
const footer = { fontSize: '12px', color: '#9CA3AF' };
