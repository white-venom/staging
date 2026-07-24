"""Real (not simulated) outbound email, currently used only for the tenant
onboarding welcome message. Best-effort and non-blocking everywhere it's
called from -- an email failure must never roll back or fail the action that
triggered it (matches the audit-log and SSL-trigger fire-and-forget pattern
used elsewhere in super_admin.py).

Needs SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM set in the
environment to actually send anything -- with none of them set (the case on
production today, see docs/VPS_INFRASTRUCTURE.md), send_tenant_onboarding_email
logs a clear one-line skip notice and returns, exactly like the R2 backup
credentials gap this mirrors.
"""
import os
import smtplib
import ssl
from email.message import EmailMessage


def _smtp_config():
    host = os.environ.get("SMTP_HOST")
    if not host:
        return None
    return {
        "host": host,
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER"),
        "password": os.environ.get("SMTP_PASSWORD"),
        "from_addr": os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "")),
    }


def _onboarding_html(tenant_name: str, subdomain: str, admin_name: str, admin_phone: str, admin_password: str, login_url: str) -> str:
    # Matches the app's established visual language (Inter font, #2563eb blue
    # accent, slate neutrals, dense uppercase labels) so this reads as the
    # same product the client is about to log into, not a generic mailer.
    return f"""
<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;">
    <div style="background:#0d1b3e;padding:20px 28px;">
      <span style="color:#ffffff;font-weight:900;font-size:18px;letter-spacing:-0.02em;">CrediiFlow</span>
    </div>
    <div style="padding:28px;">
      <p style="font-size:9px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#2563eb;margin:0 0 6px;">Account Ready</p>
      <h1 style="font-size:18px;font-weight:900;color:#0f172a;margin:0 0 16px;">Welcome to CrediiFlow, {tenant_name}</h1>
      <p style="font-size:13px;color:#475569;line-height:1.6;margin:0 0 20px;">
        Your CrediiFlow workspace is live. Use the credentials below to sign in as the administrator for <strong>{tenant_name}</strong>.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:16px 18px;margin:0 0 22px;">
        <table style="width:100%;font-size:13px;color:#0f172a;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.05em;">Login URL</td></tr>
          <tr><td style="padding:0 0 10px;font-family:monospace;">{login_url}</td></tr>
          <tr><td style="padding:4px 0;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.05em;">Phone</td></tr>
          <tr><td style="padding:0 0 10px;font-family:monospace;">{admin_phone}</td></tr>
          <tr><td style="padding:4px 0;color:#94a3b8;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.05em;">Password</td></tr>
          <tr><td style="padding:0;font-family:monospace;">{admin_password}</td></tr>
        </table>
      </div>
      <a href="{login_url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:800;font-size:12px;text-decoration:none;padding:11px 22px;border-radius:4px;letter-spacing:0.02em;">
        Sign In to CrediiFlow
      </a>
      <p style="font-size:11px;color:#94a3b8;line-height:1.6;margin:24px 0 0;">
        For security, change this password after your first sign-in. If you didn't expect this email, contact CrediiFlow support.
      </p>
    </div>
  </div>
</div>
""".strip()


def send_tenant_onboarding_email(
    to_email: str,
    tenant_name: str,
    subdomain: str,
    admin_name: str,
    admin_phone: str,
    admin_password: str,
    login_url: str,
) -> bool:
    """Best-effort: returns True if actually sent, False otherwise (including
    when SMTP simply isn't configured yet). Never raises."""
    config = _smtp_config()
    if not config:
        print(f"[EMAIL] SMTP not configured -- skipped onboarding email to {to_email} for tenant '{tenant_name}'. "
              f"Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_FROM to enable (see docs/VPS_INFRASTRUCTURE.md).")
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = f"Welcome to CrediiFlow — {tenant_name} account is ready"
        msg["From"] = config["from_addr"]
        msg["To"] = to_email
        msg.set_content(
            f"Welcome to CrediiFlow, {tenant_name}.\n\n"
            f"Login URL: {login_url}\n"
            f"Phone: {admin_phone}\n"
            f"Password: {admin_password}\n\n"
            f"Change this password after your first sign-in."
        )
        msg.add_alternative(
            _onboarding_html(tenant_name, subdomain, admin_name, admin_phone, admin_password, login_url),
            subtype="html"
        )

        with smtplib.SMTP(config["host"], config["port"], timeout=15) as server:
            server.starttls(context=ssl.create_default_context())
            if config["user"] and config["password"]:
                server.login(config["user"], config["password"])
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send onboarding email to {to_email} for tenant '{tenant_name}': {e}")
        return False


def _otp_html(admin_name: str, otp: str, expiry_minutes: int) -> str:
    return f"""
<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:32px 16px;">
  <div style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;">
    <div style="background:#0d1b3e;padding:20px 28px;">
      <span style="color:#ffffff;font-weight:900;font-size:18px;letter-spacing:-0.02em;">CrediiFlow</span>
    </div>
    <div style="padding:28px;">
      <p style="font-size:9px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#2563eb;margin:0 0 6px;">Password Reset</p>
      <h1 style="font-size:16px;font-weight:900;color:#0f172a;margin:0 0 16px;">Hi {admin_name}, here's your code</h1>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:20px;margin:0 0 20px;text-align:center;">
        <span style="font-family:monospace;font-size:32px;font-weight:900;letter-spacing:0.15em;color:#0f172a;">{otp}</span>
      </div>
      <p style="font-size:13px;color:#475569;line-height:1.6;margin:0;">
        This code expires in <strong>{expiry_minutes} minutes</strong>. If you didn't request a password reset, you can safely ignore this email — your password hasn't changed.
      </p>
    </div>
  </div>
</div>
""".strip()


def send_password_reset_otp_email(to_email: str, admin_name: str, otp: str, expiry_minutes: int = 10) -> bool:
    """Same best-effort/never-raises contract as send_tenant_onboarding_email."""
    config = _smtp_config()
    if not config:
        print(f"[EMAIL] SMTP not configured -- skipped password reset OTP to {to_email}. "
              f"Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_FROM to enable (see docs/VPS_INFRASTRUCTURE.md).")
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = "Your CrediiFlow password reset code"
        msg["From"] = config["from_addr"]
        msg["To"] = to_email
        msg.set_content(
            f"Hi {admin_name},\n\n"
            f"Your CrediiFlow password reset code is: {otp}\n\n"
            f"This code expires in {expiry_minutes} minutes. If you didn't request this, ignore this email."
        )
        msg.add_alternative(_otp_html(admin_name, otp, expiry_minutes), subtype="html")

        with smtplib.SMTP(config["host"], config["port"], timeout=15) as server:
            server.starttls(context=ssl.create_default_context())
            if config["user"] and config["password"]:
                server.login(config["user"], config["password"])
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send password reset OTP to {to_email}: {e}")
        return False
