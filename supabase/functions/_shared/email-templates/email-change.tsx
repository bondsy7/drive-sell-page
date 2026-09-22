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

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Neue E-Mail-Adresse für {siteName} bestätigen</Preview>
    <Body style={emailStyles.body}>
      <EmailFrame>
        <Heading style={emailStyles.heading}>E-Mail-Adresse ändern</Heading>
        <Text style={emailStyles.text}>
          Für Ihr Konto bei {siteName} wurde eine Änderung der E-Mail-Adresse von{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          auf{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          {' '}angefordert.
        </Text>
        <Text style={emailStyles.text}>
          Bestätigen Sie die Änderung über die folgende Schaltfläche:
        </Text>
        <Button style={emailStyles.button} href={confirmationUrl}>
          Neue E-Mail-Adresse bestätigen
        </Button>
        <Text style={emailStyles.note}>
          Falls Sie diese Änderung nicht angefordert haben, ändern Sie bitte umgehend Ihr Passwort
          und wenden Sie sich schriftlich an info@breadcrumb.de.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default EmailChangeEmail

const link = emailStyles.link
