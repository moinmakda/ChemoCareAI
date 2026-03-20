"""
Email service for sending patient credentials via SMTP.
Uses Gmail SMTP with app-specific password.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "noreply.jivana@gmail.com"
SMTP_PASSWORD = "etxs fvxo uwqc htgl"
FROM_NAME = "ChemoCare"


async def send_patient_credentials_email(
    to_email: str,
    patient_name: str,
    login_email: str,
    login_password: str,
    protocol_name: str,
    start_date: str,
    doctor_name: str,
) -> bool:
    """Send patient login credentials via email. Returns True on success."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"ChemoCare - Your Treatment Portal Access"
        msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
        msg["To"] = to_email

        text_body = f"""Dear {patient_name},

Your doctor ({doctor_name}) has registered you on the ChemoCare treatment management portal.

Your Login Credentials:
  Email: {login_email}
  Password: {login_password}

Treatment Details:
  Protocol: {protocol_name}
  Start Date: {start_date}

Please download the ChemoCare app and log in with the credentials above. You can change your password after your first login.

Important: Keep these credentials safe and do not share them with others.

If you have any questions, please contact your care team.

Best regards,
ChemoCare Team
"""

        html_body = f"""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366F1, #8B5CF6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">ChemoCare</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Treatment Management Portal</p>
  </div>

  <div style="background: #ffffff; padding: 24px; border: 1px solid #E2E8F0; border-top: none;">
    <p style="font-size: 16px; color: #1E293B;">Dear <strong>{patient_name}</strong>,</p>
    <p style="color: #475569;">Your doctor (<strong>{doctor_name}</strong>) has registered you on ChemoCare.</p>

    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px; color: #1E293B; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Login Credentials</h3>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 4px 0; color: #64748B; width: 80px;">Email:</td>
          <td style="padding: 4px 0; color: #1E293B; font-weight: 600;">{login_email}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748B;">Password:</td>
          <td style="padding: 4px 0; color: #1E293B; font-weight: 600; font-family: monospace; font-size: 15px;">{login_password}</td>
        </tr>
      </table>
    </div>

    <div style="background: #F0FDF4; border-left: 4px solid #22C55E; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #166534;"><strong>Treatment:</strong> {protocol_name}</p>
      <p style="margin: 4px 0 0; color: #166534;"><strong>Start Date:</strong> {start_date}</p>
    </div>

    <p style="color: #475569; font-size: 14px;">Please download the ChemoCare app and log in with the credentials above.</p>
    <p style="color: #94A3B8; font-size: 12px; margin-top: 20px;">Keep these credentials safe. Do not share them with others.</p>
  </div>

  <div style="background: #F8FAFC; padding: 16px; border-radius: 0 0 12px 12px; border: 1px solid #E2E8F0; border-top: none; text-align: center;">
    <p style="margin: 0; color: #94A3B8; font-size: 12px;">ChemoCare Team | Powered by Jivana Healthcare</p>
  </div>
</div>
"""

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        # Send via SMTP (synchronous but fast for single email)
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())

        logger.info(f"Credentials email sent to {to_email} for {patient_name}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False
