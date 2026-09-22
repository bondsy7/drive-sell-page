/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Container,
  Hr,
  Img,
  Link,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://autohaus.ai/__l5e/assets-v1/3137117d-1dd6-43fa-a9a5-9485d749913b/auto3-logo.png'
const LEGAL_BASE_URL = 'https://autohaus.ai'

export const emailStyles = {
  body: {
    backgroundColor: '#ffffff',
    color: '#212121',
    fontFamily: 'Arial, Helvetica, sans-serif',
    margin: '0',
    padding: '32px 12px',
  },
  container: {
    backgroundColor: '#f8f7f5',
    border: '1px solid #e3e0dc',
    borderRadius: '12px',
    margin: '0 auto',
    maxWidth: '600px',
    overflow: 'hidden' as const,
  },
  content: { padding: '38px 42px 34px' },
  heading: {
    color: '#212121',
    fontSize: '26px',
    fontWeight: '700' as const,
    lineHeight: '1.25',
    margin: '0 0 20px',
  },
  text: {
    color: '#555555',
    fontSize: '15px',
    lineHeight: '1.65',
    margin: '0 0 20px',
  },
  button: {
    backgroundColor: '#174f6b',
    borderRadius: '8px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: '700' as const,
    padding: '13px 22px',
    textDecoration: 'none',
  },
  note: {
    backgroundColor: '#eef3f5',
    borderLeft: '3px solid #174f6b',
    color: '#555555',
    fontSize: '13px',
    lineHeight: '1.55',
    margin: '28px 0 0',
    padding: '13px 15px',
  },
  link: { color: '#174f6b', textDecoration: 'underline' },
  code: {
    backgroundColor: '#ffffff',
    border: '1px solid #d8d5d1',
    borderRadius: '8px',
    color: '#212121',
    display: 'inline-block',
    fontFamily: 'Courier, monospace',
    fontSize: '28px',
    fontWeight: '700' as const,
    letterSpacing: '4px',
    margin: '2px 0 8px',
    padding: '13px 18px',
  },
}

export const EmailHeader = () => (
  <Section style={{ backgroundColor: '#ffffff', padding: '25px 42px', textAlign: 'left' as const }}>
    <Img src={LOGO_URL} width="145" height="45" alt="AUTO3" style={{ display: 'block' }} />
  </Section>
)

export const EmailFooter = () => (
  <Section style={{ padding: '0 42px 30px' }}>
    <Hr style={{ borderColor: '#dedbd7', margin: '0 0 22px' }} />
    <Text style={{ color: '#737373', fontSize: '11px', lineHeight: '1.6', margin: '0 0 10px' }}>
      AUTO3 ist ein Produkt der Breadcrumb Marketing GmbH, Corniceliusstraße 8, 63450 Hanau.
      Geschäftsführung: Leonhard Paul · Amtsgericht Hanau, HRB 91223 · USt-IdNr. DE 237 914 287
    </Text>
    <Text style={{ color: '#737373', fontSize: '11px', lineHeight: '1.8', margin: '0' }}>
      <Link href={`${LEGAL_BASE_URL}/impressum`} style={emailStyles.link}>Impressum</Link>
      {' · '}
      <Link href={`${LEGAL_BASE_URL}/datenschutz`} style={emailStyles.link}>Datenschutz</Link>
      {' · '}
      <Link href={`${LEGAL_BASE_URL}/agb`} style={emailStyles.link}>AGB</Link>
    </Text>
  </Section>
)

export const EmailFrame = ({ children }: { children: React.ReactNode }) => (
  <Container style={emailStyles.container}>
    <EmailHeader />
    <Section style={emailStyles.content}>{children}</Section>
    <EmailFooter />
  </Container>
)
