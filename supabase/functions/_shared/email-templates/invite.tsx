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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Ihre Einladung zu {siteName}</Preview>
    <Body style={emailStyles.body}>
      <EmailFrame>
        <Heading style={emailStyles.heading}>Sie wurden eingeladen</Heading>
        <Text style={emailStyles.text}>
          Sie wurden zur Nutzung von{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          {' '}eingeladen. Nehmen Sie die Einladung an, um Ihr Konto einzurichten.
        </Text>
        <Button style={emailStyles.button} href={confirmationUrl}>
          Einladung annehmen
        </Button>
        <Text style={emailStyles.note}>
          Falls Sie keine Einladung erwartet haben, können Sie diese Nachricht ignorieren.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default InviteEmail

const link = emailStyles.link
