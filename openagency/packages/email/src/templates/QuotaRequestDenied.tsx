import { Html, Body, Container, Text, Hr, Preview, Head, Section } from '@react-email/components';
import * as React from 'react';

interface Props {
  agencyName: string;
  month: string;
  reason?: string;
}

export function QuotaRequestDenied({ agencyName, month, reason }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Quota request denied — {agencyName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Plinth</Text>
          </Section>
          <Text style={heading}>Quota Request Denied</Text>
          <Text style={text}>Your request for additional pipeline runs was not approved.</Text>
          <Section style={table}>
            <Text style={row}><strong>Agency:</strong> {agencyName}</Text>
            <Text style={row}><strong>Month:</strong> {month}</Text>
            {reason && <Text style={row}><strong>Reason:</strong> {reason}</Text>}
          </Section>
          <Text style={text}>Contact your Plinth administrator if you need further assistance.</Text>
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
const table = { backgroundColor: '#FEF2F2', borderRadius: '6px', padding: '16px' };
const row = { fontSize: '14px', lineHeight: '28px', color: '#374151', margin: '0' };
const hr = { borderColor: '#E5E7EB', marginTop: '24px', marginBottom: '24px' };
const footer = { fontSize: '12px', color: '#9CA3AF' };
