import { Resend } from 'resend';
import { logger } from '@/lib/logger';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

function inviteEmailHtml({
  inviteeName,
  familyName,
  familyIdentityRole,
  appPermissionRole,
  inviteUrl,
  expiresAt,
}: {
  inviteeName:        string;
  familyName:         string;
  familyIdentityRole: string;
  appPermissionRole:  string;
  inviteUrl:          string;
  expiresAt:          string;
}) {
  const expiry = new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const roleLabel = familyIdentityRole.charAt(0).toUpperCase() +
    familyIdentityRole.slice(1).replace('_', ' ');

  const accessDesc =
    appPermissionRole === 'admin'       ? 'can invite members and write breadcrumbs' :
    appPermissionRole === 'contributor' ? 'can write breadcrumbs' :
                                          'can read breadcrumbs and use the Family Agent';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to Breadcrumbs</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0D0D0D;border:1px solid #333333;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px;text-align:center;border-bottom:1px solid #333333;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#C8963E;letter-spacing:0.04em;">
                Breadcrumbs
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#A6A6A6;letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;">
                Letters for the ones you love
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 24px;font-size:26px;color:#ffffff;line-height:1.3;font-family:Georgia,'Times New Roman',serif;">
                You've been invited to join ${familyName}
              </p>

              <p style="margin:0 0 16px;font-size:15px;color:#ffffff;line-height:1.6;font-family:Arial,sans-serif;">
                Hi ${inviteeName},
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#A6A6A6;line-height:1.6;font-family:Arial,sans-serif;">
                You've been invited to join a family on Breadcrumbs as <strong style="color:#ffffff;">${roleLabel}</strong>.
                As a member, you ${accessDesc}.
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#A6A6A6;line-height:1.6;font-family:Arial,sans-serif;">
                Breadcrumbs is a private family space for writing letters, stories, and life lessons
                that will be passed down to the next generation.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}"
                       style="display:inline-block;background:#C8963E;color:#000000;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;padding:14px 40px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <p style="margin:24px 0 0;font-size:12px;color:#A6A6A6;line-height:1.6;font-family:Arial,sans-serif;text-align:center;">
                Or copy this link into your browser:<br />
                <span style="color:#C8963E;word-break:break-all;">${inviteUrl}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #333333;text-align:center;">
              <p style="margin:0;font-size:11px;color:#A6A6A6;font-family:Arial,sans-serif;line-height:1.6;">
                This invitation expires on ${expiry}.<br />
                If you weren't expecting this, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface SendInviteEmailParams {
  inviteeName:        string;
  inviteeEmail:       string;
  familyName:         string;
  familyIdentityRole: string;
  appPermissionRole:  string;
  inviteUrl:          string;
  expiresAt:          string;
}

/** Non-throwing — logs on failure so the caller can continue. */
export async function sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
  const resend = getResend();

  const subject = `You're invited to join ${params.familyName} on Breadcrumbs`;

  try {
    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL!,
      to:      params.inviteeEmail,
      subject,
      html:    inviteEmailHtml(params),
    });

    if (error) {
      logger.error('sendInviteEmail: Resend API error', {
        code:    error.name,
        message: error.message,
        to:      params.inviteeEmail,
      });
    } else {
      logger.info('invite email sent', { to: params.inviteeEmail });
    }
  } catch (err) {
    logger.error('sendInviteEmail: unexpected error', {
      error: err instanceof Error ? err.message : String(err),
      to:    params.inviteeEmail,
    });
  }
}
