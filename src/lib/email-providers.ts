// Mail server presets for a team's own email (Settings → Email). Safe on server and client.

export type MailSecurity = "ssl" | "starttls";

export interface MailProvider {
  id: string;
  label: string;
  host: string;
  port: number;
  security: MailSecurity;
  /** What to put in the password box, and where to get it */
  passwordHelp: string;
  helpUrl?: string;
}

export const MAIL_PROVIDERS: MailProvider[] = [
  {
    id: "gmail", label: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 465, security: "ssl",
    passwordHelp: "An app password (not your normal password): turn on 2-Step Verification, then create one under Google Account → Security → App passwords.",
    helpUrl: "https://myaccount.google.com/apppasswords",
  },
  {
    id: "outlook", label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, security: "starttls",
    passwordHelp: "Your password, or an app password if the account uses two-step verification. Microsoft 365 admins may need to allow \"Authenticated SMTP\" for the mailbox.",
    helpUrl: "https://support.microsoft.com/account-billing/how-to-get-and-use-app-passwords-5896ed9b-4263-e681-128a-a6f2979a7944",
  },
  {
    id: "yahoo", label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: 465, security: "ssl",
    passwordHelp: "An app password from Yahoo Account Security → Generate app password.",
    helpUrl: "https://login.yahoo.com/account/security",
  },
  {
    id: "icloud", label: "iCloud Mail", host: "smtp.mail.me.com", port: 587, security: "starttls",
    passwordHelp: "An app-specific password from appleid.apple.com → Sign-In and Security.",
    helpUrl: "https://appleid.apple.com",
  },
  {
    id: "zoho", label: "Zoho Mail", host: "smtp.zoho.com", port: 465, security: "ssl",
    passwordHelp: "Your password, or an application-specific password if two-factor authentication is on.",
  },
  {
    id: "custom", label: "Other (enter the server)", host: "", port: 587, security: "starttls",
    passwordHelp: "The password for the account on your mail server.",
  },
];

export const PROVIDER_BY_ID: Record<string, MailProvider> = Object.fromEntries(MAIL_PROVIDERS.map((p) => [p.id, p]));

/** Ports mail servers accept submissions on — anything else is refused */
export const MAIL_PORTS = [25, 465, 587, 2525];
