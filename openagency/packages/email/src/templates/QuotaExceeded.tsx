import { Html, Body, Container, Text, Hr, Preview, Head, Section, Button } from '@react-email/components';
import * as React from 'react';

interface Props {
  agencyName: string;
  month: string;
  runType: string;
  used: number;
  limit: number;
  appUrl: string;
  isAdmin?: boolean;
}

export function QuotaExceeded({ agencyName, month, runType, used, limit, appUrl, isAdmin }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{agencyName} has reached their {runType} run limit</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Plinth</Text>
          </Section>
          <Text style={heading}>Run Limit Reached</Text>
          <Text style={text}>
            {isAdmin
              ? `Agency "${agencyName}" has reached their monthly ${runType} run limit.`
              : `Your agency has reached the monthly ${runType} run limit.`}
          </Text>
          <Section style={table}>
            <Text style={row}><strong>Agency:</strong> {agencyName}</Text>
            <Text style={row}><strong>Month:</strong> {month}</Text>
            <Text style={row}><strong>Run type:</strong> {runType}</Text>
            <Text style={row}><strong>Usage:</strong> {used} / {limit} runs</Text>
          </Section>
          {isAdmin ? (
            <Section style={{ textAlign: 'center' as const, marginTop: '24px' }}>
              <Button href={`${appUrl}/app/admin`} style={btn}>
                Grant Extra Runs
              </Button>
            </Section>
          ) : (
            <>
              <Text style={text}>You can request additional runs from your Plinth administrator.</Text>
              <Section style={{ textAlign: 'center' as const, marginTop: '24px' }}>
                <Button href={`${appUrl}/app/settings/usage`} style={btn}>
                  Request More Runs
                </Button>
              </Section>
            </>
          )}
          <Hr style={hr} />
          <Text style={footer}>Quotas reset on the 1st of each month. Unused runs do not carry over.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#f6f9fc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };
const container = { backgroundColor: '#ffffff', margin: '0 auto', padding: '40px 20px', maxWidth: '560px', borderRadius: '8px' };
const header = { backgroundColor: '#0F172A', padding: '20px', borderRadius: '8px 8px 0 0', marginBottom: '24px', marginTop: '-40px', marginLeft: '-20px', marginRight: '-20px' };
const logo = { color: '#ffffff', fontSize: '24px', fontWeight: '700' as const, margin: '0', textAlign: 'center' as const };
const heading = { fontSize: '20px', fontWeight: '600' as const, color: '#EF4444', marginBottom: '16px' };
const text = { fontSize: '14px', color: '#374151', lineHeight: '24px' };
const table = { backgroundColor: '#FEF2F2', borderRadius: '6px', padding: '16px' };
const row = { fontSize: '14px', lineHeight: '28px', color: '#374151', margin: '0' };
const btn = { backgroundColor: '#02c98d', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none' };
const hr = { borderColor: '#E5E7EB', marginTop: '24px', marginBottom: '24px' };
const footer = { fontSize: '12px', color: '#9CA3AF' };
