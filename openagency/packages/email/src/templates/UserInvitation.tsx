import {
  Html, Body, Container, Text, Button, Hr, Preview, Head, Section,
} from '@react-email/components';
import * as React from 'react';

interface Props {
  inviterName: string;
  agencyName: string;
  role: string;
  acceptUrl: string;
}

export function UserInvitation({ inviterName, agencyName, role, acceptUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{inviterName} invited you to join {agencyName} on Plinth</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Plinth</Text>
          </Section>
          <Text style={heading}>You&apos;re invited</Text>
          <Text style={paragraph}>
            <strong>{inviterName}</strong> invited you to join <strong>{agencyName}</strong> on Plinth as <strong>{role}</strong>.
          </Text>
          <Text style={paragraph}>
            Plinth is an AI-powered media optimization platform that helps agencies identify waste, optimize budgets, and deliver measurable outcomes.
          </Text>
          <Section style={btnContainer}>
            <Button style={button} href={acceptUrl}>
              Accept Invitation
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t expect this invitation, you can safely ignore this email.
          </Text>
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
