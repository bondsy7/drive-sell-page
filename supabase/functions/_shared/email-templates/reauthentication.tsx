/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { EmailFrame, emailStyles } from './email-layout.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Ihr Bestätigungscode für autohaus.ai</Preview>
    <Body style={emailStyles.body}>
      <EmailFrame>
        <Heading style={emailStyles.heading}>Identität bestätigen</Heading>
        <Text style={emailStyles.text}>
          Verwenden Sie den folgenden Code, um die angeforderte sicherheitsrelevante Aktion zu bestätigen:
        </Text>
        <Text style={emailStyles.code}>{token}</Text>
        <Text style={emailStyles.note}>
          Der Code ist nur für kurze Zeit gültig. Falls Sie ihn nicht angefordert haben, ignorieren
          Sie diese Nachricht und geben Sie den Code nicht an Dritte weiter.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default ReauthenticationEmail

