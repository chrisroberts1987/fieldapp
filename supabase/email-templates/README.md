# Supabase auth email templates

Paste each file's contents into the matching template in
**Supabase Dashboard → Authentication → Email Templates**.

| File                  | Supabase template     | Variables used                |
| --------------------- | --------------------- | ----------------------------- |
| `confirm-signup.html` | Confirm signup        | `{{ .ConfirmationURL }}`      |
| `reset-password.html` | Reset password        | `{{ .ConfirmationURL }}`      |
| `change-email.html`   | Change email address  | `{{ .ConfirmationURL }}`      |
| `invite-user.html`    | Invite user           | `{{ .ConfirmationURL }}`      |

All four share the same dark-band header + light card layout for
broad email-client compatibility. Each varies only the headline,
body, button label, and security disclaimer.
