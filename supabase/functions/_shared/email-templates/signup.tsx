/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { EmailFrame, emailStyles } from './email-layout.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>E-Mail-Adresse für {siteName} bestätigen</Preview>
    <Body style={emailStyles.body}>
      <EmailFrame>
        <Heading style={emailStyles.heading}>E-Mail-Adresse bestätigen</Heading>
        <Text style={emailStyles.text}>
          Vielen Dank für Ihre Registrierung bei{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Text style={emailStyles.text}>
          Bitte bestätigen Sie Ihre E-Mail-Adresse (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) über die folgende Schaltfläche:
        </Text>
        <Button style={emailStyles.button} href={confirmationUrl}>
          E-Mail-Adresse bestätigen
        </Button>
        <Text style={emailStyles.note}>
          Falls Sie kein Konto erstellt haben, können Sie diese Nachricht ignorieren.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default SignupEmail

const link = emailStyles.link
