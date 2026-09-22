/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { EmailFrame, emailStyles } from './email-layout.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Ihr Anmeldelink für {siteName}</Preview>
    <Body style={emailStyles.body}>
      <EmailFrame>
        <Heading style={emailStyles.heading}>Ihr Anmeldelink</Heading>
        <Text style={emailStyles.text}>
          Über die folgende Schaltfläche können Sie sich bei {siteName} anmelden.
          Der Link ist nur für kurze Zeit gültig und darf nicht weitergegeben werden.
        </Text>
        <Button style={emailStyles.button} href={confirmationUrl}>
          Jetzt anmelden
        </Button>
        <Text style={emailStyles.note}>
          Falls Sie diesen Anmeldelink nicht angefordert haben, können Sie diese Nachricht ignorieren.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default MagicLinkEmail

