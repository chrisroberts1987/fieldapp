# Auth Email Setup — Supabase + Resend SMTP

By default, Supabase sends auth emails (confirmation, password reset, magic link) from `noreply@mail.supabase.co` and rate-limits them. Routing them through Resend gets us:

- Sender is `MyForeman <noreply@myforemanhq.com>` so customers trust it
- No Supabase rate limit
- Deliverability + analytics live in the Resend dashboard alongside our other transactional mail

All configuration is in the Supabase dashboard — there is no migration. The HTML files in this folder are the templates to paste into Supabase's Email Templates tab.

## Step 1: Get a Resend API key

If you don't already have one from earlier setup:

1. `resend.com` → sign in to the MyForeman account
2. **API Keys** → **Create API Key**
3. Name it `Supabase SMTP`
4. Permission: **Sending access** is enough
5. Copy the key (`re_...`). You'll paste it as the SMTP password in step 2.

(If you already have a Resend key in Vercel env vars, you can reuse the same key.)

## Step 2: Enable custom SMTP in Supabase

1. `supabase.com/dashboard` → your project
2. Sidebar → **Project Settings** → **Authentication**
3. Scroll to **SMTP Settings**
4. Toggle **Enable Custom SMTP** on
5. Fill in:

   | Field | Value |
   |---|---|
   | Sender email | `noreply@myforemanhq.com` |
   | Sender name | `MyForeman` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | the Resend API key from step 1 |
   | Minimum interval between emails | `60` (seconds — Supabase rejects 0) |

6. **Save**
7. **Send test email** — Supabase has a button to verify. Send one to your own inbox; it should land within ~10 seconds with `MyForeman <noreply@myforemanhq.com>` in the From field.

## Step 3: Paste the branded templates

1. Sidebar → **Authentication** → **Email Templates**
2. For each template below, open the tab, replace the **Message body (HTML)** with the contents of the corresponding file, and Save.

| Supabase template | File | Variables used |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `{{ .ConfirmationURL }}` |
| Reset password | `reset-password.html` | `{{ .ConfirmationURL }}` |
| Magic Link | `magic-link.html` | `{{ .ConfirmationURL }}` |
| Change email address | `change-email.html` | `{{ .ConfirmationURL }}` |
| Invite user | `invite-user.html` | `{{ .ConfirmationURL }}` |

Update the subject lines too:

| Template | Subject |
|---|---|
| Confirm signup | `Confirm your MyForeman email` |
| Reset password | `Reset your MyForeman password` |
| Magic Link | `Sign in to MyForeman` |
| Change email address | `Confirm your new MyForeman email` |
| Invite user | `You've been invited to MyForeman` |

The templates use Supabase's standard `{{ .ConfirmationURL }}` placeholder, which Supabase fills in at send time. No code change needed.

## Step 4: Verify end-to-end

1. Sign up a fresh email at `myforemanhq.com/signup`
2. Check inbox — sender should read **MyForeman** with the email address `noreply@myforemanhq.com`
3. Email body should show the dark MyForeman header with the blue **CONFIRM EMAIL** button
4. Click the button — should land on `myforemanhq.com` and complete the signup

If something looks off:

- Generic blue Supabase-styled email → templates weren't saved, repeat step 3
- Sender shows `mail.supabase.co` → SMTP toggle isn't actually on, repeat step 2
- Link 404s → Site URL is misconfigured (Authentication → URL Configuration → Site URL should be `https://www.myforemanhq.com`)

## Step 5 (optional): Domain reputation

In Resend → **Domains** → make sure `myforemanhq.com` shows all-green SPF, DKIM, DMARC. If anything is warning or missing, follow the DNS records they ask for (add them in Namecheap). Without DKIM, Gmail will route confirmation emails to spam more often than not.

---

## Why these specific values?

- **Port 465 over 587**: 465 is implicit TLS, which Supabase's SMTP client prefers. 587 is STARTTLS and works too but occasionally has handshake issues on different providers' servers.
- **Username is literally `resend`**: Resend's SMTP auth is API-key-based, not user/password. The username field is required by the SMTP spec but they ignore the value; the API key in the password field is what authenticates.
- **`noreply@` as sender**: replies to auth emails are noise. If we wanted a reply-to address, we'd add it on each branded email separately via the Resend API. The auth emails are fire-and-forget.

## Design notes (when editing templates)

All templates share one design system:
- Body background `#0d1726`, card `#1a2236`, border `#2e3f60`
- Headline: Bebas Neue at 28px, color `#f0f4ff`
- Primary button: `#4f9eff` background, white text, 10px radius
- Body text `#c8d4ee`, captions/meta `#7a8db0`
- Footer divider 1px `#2e3f60` with a small "myforemanhq.com" link

Each varies only the headline, body, button label, and security disclaimer. Keep the shell the same so all 5 templates look like one family.
