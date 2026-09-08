import random
import smtplib
import os

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def generate_otp():
    """Generate a 6-digit OTP."""
    return str(random.randint(100000, 999999))


def send_otp_email(receiver_email, otp):
    """Send OTP to the user's email."""

    sender_email = os.getenv("MAIL_USERNAME")
    sender_password = os.getenv("MAIL_PASSWORD")

    if not sender_email or not sender_password:
        raise Exception(
            "MAIL_USERNAME or MAIL_PASSWORD is missing in .env"
        )

    subject = "MeetSpace Email Verification OTP"

    body = f"""
Hello,

Your MeetSpace verification OTP is:

{otp}

This OTP is valid for 5 minutes.

If you did not request this OTP, please ignore this email.

Regards,
MeetSpace Team
"""

    message = MIMEMultipart()

    message["From"] = sender_email
    message["To"] = receiver_email
    message["Subject"] = subject

    message.attach(
        MIMEText(body, "plain")
    )

    with smtplib.SMTP(
        "smtp.gmail.com",
        587
    ) as server:

        server.starttls()

        server.login(
            sender_email,
            sender_password
        )

        server.sendmail(
            sender_email,
            receiver_email,
            message.as_string()
        )

    return True