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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Passwort für {siteName} zurücksetzen</Preview>
    <Body style={emailStyles.body}>
      <EmailFrame>
        <Heading style={emailStyles.heading}>Passwort zurücksetzen</Heading>
        <Text style={emailStyles.text}>
          Für Ihr Konto bei {siteName} wurde das Zurücksetzen des Passworts angefordert.
          Über die folgende Schaltfläche können Sie ein neues Passwort festlegen.
        </Text>
        <Button style={emailStyles.button} href={confirmationUrl}>
          Neues Passwort festlegen
        </Button>
        <Text style={emailStyles.note}>
          Falls Sie dies nicht angefordert haben, ignorieren Sie diese Nachricht. Ihr Passwort
          bleibt unverändert. Geben Sie diesen Link nicht an Dritte weiter.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default RecoveryEmail

