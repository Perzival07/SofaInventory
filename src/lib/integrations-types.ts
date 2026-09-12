/**
 * External service credentials.
 *
 * Only services this app can actually use are listed. An empty box for a
 * service nothing reads would be worse than not offering it.
 */

export type FieldKind = "secret" | "text";

export interface IntegrationField {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  hint?: string;
}

export interface IntegrationDef {
  code: string;
  name: string;
  purpose: string;
  /** Where this credential is actually consumed in the app */
  used_by: string;
  docs_hint: string;
  fields: IntegrationField[];
  /** Not yet wired to anything — stored, but nothing reads it */
  planned?: boolean;
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    code: "google_oauth",
    name: "Google Sign-In",
    purpose: "Already active — this page is a reference, not where you configure it.",
    used_by:
      "Login. Configured through AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET and " +
      "AUTH_ALLOWED_EMAILS as environment variables, NOT here.",
    docs_hint:
      "Credentials needed to sign in cannot live behind the sign-in, so they stay in " +
      "environment variables. If the database were unreachable you would otherwise be " +
      "locked out permanently. Set them on Vercel → Settings → Environment Variables.",
    // No fields: nothing to store here, and offering boxes that do nothing would
    // imply sign-in is configured from this page when it is not.
    fields: [],
  },
  {
    code: "whatsapp",
    name: "WhatsApp Business API",
    purpose: "Order status to customers and job work status to vendors.",
    used_by: "Order status changes, khata due reminders, job work dispatch.",
    docs_hint: "Meta for Developers → WhatsApp → API Setup. You need the phone number ID and a permanent access token.",
    planned: true,
    fields: [
      { key: "phone_number_id", label: "Phone Number ID", kind: "text", placeholder: "1029384756" },
      { key: "access_token", label: "Access Token", kind: "secret", placeholder: "EAAG..." },
      { key: "business_account_id", label: "Business Account ID", kind: "text" },
    ],
  },
  {
    code: "sms",
    name: "SMS Gateway",
    purpose: "Fallback for customers not on WhatsApp — delivery slots and khata reminders.",
    used_by: "Khata due reminders, delivery scheduling.",
    docs_hint: "Any Indian gateway (MSG91, TextLocal, Gupshup). Needs an API key and an approved sender ID.",
    planned: true,
    fields: [
      { key: "provider", label: "Provider", kind: "text", placeholder: "msg91" },
      { key: "api_key", label: "API Key", kind: "secret" },
      { key: "sender_id", label: "Sender ID", kind: "text", placeholder: "LOKNTH",
        hint: "Six characters, must be pre-approved by the gateway." },
    ],
  },
  {
    code: "upi",
    name: "UPI Collection",
    purpose: "Generate a payment QR tied to a specific bill number.",
    used_by: "Cash memo and tax invoice printing, day-end reconciliation.",
    docs_hint: "Your UPI VPA is enough for a static QR. A payment gateway key is only needed for automatic reconciliation.",
    planned: true,
    fields: [
      { key: "vpa", label: "UPI ID (VPA)", kind: "text", placeholder: "loknathsofa@okhdfcbank" },
      { key: "merchant_name", label: "Merchant Name", kind: "text", placeholder: "Loknath Sofa Center" },
      { key: "gateway_key", label: "Gateway API Key", kind: "secret",
        hint: "Optional — only for automatic payment reconciliation." },
    ],
  },
  {
    code: "gst_portal",
    name: "GST Portal / E-Way Bill",
    purpose: "E-way bills and return filing once the shop registers.",
    used_by: "Dormant until the tax regime is enabled.",
    docs_hint: "Credentials come from a GSP (ClearTax, Masters India). Not needed while unregistered.",
    planned: true,
    fields: [
      { key: "gsp_username", label: "GSP Username", kind: "text" },
      { key: "gsp_password", label: "GSP Password", kind: "secret" },
      { key: "api_key", label: "API Key", kind: "secret" },
    ],
  },
];

/** What the UI receives — never the secret itself. */
export interface StoredCredential {
  service_code: string;
  field_key: string;
  /** Masked for display: demo_key_••••••••9876 */
  masked_value: string;
  is_secret: boolean;
  updated_at: string;
}

export interface IntegrationStatus {
  code: string;
  configured: boolean;
  /** Fields filled out of fields required */
  filled: number;
  total: number;
  credentials: StoredCredential[];
}
