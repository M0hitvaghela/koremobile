from __future__ import annotations

import json
import logging
from email.message import EmailMessage
from typing import List
import aiosmtplib

from app.core.config import settings

logger = logging.getLogger("koremobile.email")

# ─── Mobile-first design tokens ───────────────────────────────────────────────
_BASE_STYLE = """
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f0f4f8;font-family:'Plus Jakarta Sans',Arial,sans-serif;
     -webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;width:100%!important}
.email-outer{width:100%;background:#f0f4f8;padding:16px 0 32px}
.wrapper{max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden}
.header{background:#0b3d91;padding:28px 20px 24px;text-align:center}
.logo-row{display:inline-flex;align-items:center;gap:9px}
.logo-box{width:36px;height:36px;background:rgba(255,255,255,.18);border-radius:9px;
          display:inline-flex;align-items:center;justify-content:center}
.logo-name{font-size:20px;font-weight:700;color:#fff;letter-spacing:-.2px}
.header-sub{font-size:11px;color:rgba(255,255,255,.55);margin-top:5px;letter-spacing:.8px}
.body{padding:28px 20px}
p{font-size:15px;line-height:1.75;color:#374151;margin-bottom:14px}
.greeting{font-size:17px;font-weight:700;color:#111827;margin-bottom:10px}
.btn{display:block;width:100%;padding:16px 20px;background:#0b3d91;color:#ffffff!important;
     text-decoration:none;border-radius:12px;font-size:16px;font-weight:700;
     text-align:center;margin:20px 0;letter-spacing:.1px}
hr{border:none;border-top:1px solid #e5e7eb;margin:22px 0}
.sig{font-size:14px;color:#6b7280}
.sig strong{color:#0b3d91}
.footer{background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e5e7eb}
.footer p{font-size:11px;color:#9ca3af;line-height:1.7}
.footer a{color:#0b3d91;text-decoration:none}
@media (max-width:480px){
  .wrapper{border-radius:0}
  .email-outer{padding:0}
}
"""


def _logo_svg() -> str:
    return (
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" '
        'stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
        '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
    )


def _shell(extra_css: str, body_html: str, preview: str = "") -> str:
    preview_span = (
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;'
        f'font-size:1px;color:#f8fafc;">{preview}&nbsp;</div>'
        if preview else ""
    )
    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Koremobile</title>
  <style>{_BASE_STYLE}{extra_css}</style>
</head>
<body>
{preview_span}
<div class="email-outer">
  <div class="wrapper">
    <div class="header">
      <div class="logo-row">
        <span class="logo-box">{_logo_svg()}</span>
        <span class="logo-name">Koremobile</span>
      </div>
      <div class="header-sub">YOUR MOBILE SOLUTION</div>
    </div>
    {body_html}
    <div class="footer">
      <p>© 2025 Koremobile. All rights reserved.<br>
         <a href="#">Unsubscribe</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#">Privacy Policy</a>
      </p>
    </div>
  </div>
</div>
</body>
</html>"""


# ─── Transport ─────────────────────────────────────────────────────────────────

async def _send_email(message: EmailMessage) -> bool:
    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            start_tls=True,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
        )
        return True
    except Exception as exc:
        logger.error(f"[Email] SMTP send failed: {exc}")
        return False


# ─── Redis Queue ───────────────────────────────────────────────────────────────
# Flow:
#   1. Try send instantly via SMTP
#   2. If fails → push job to Redis queue (attempt=1 already used)
#   3. Worker retries every 30s, up to MAX_RETRY total attempts
#   4. After MAX_RETRY failures → moved to email:failed (dead list)
#
# Job schema:
# {
#   "type":    "order_confirmation" | "payment_failed" | "welcome" | "otp",
#   "to":      "user@example.com",
#   "data":    { ...template-specific fields... },
#   "attempt": 1          ← starts at 1 because instant send already tried once
# }

QUEUE_KEY  = "email:queue"    # LIST – pending retry jobs
FAILED_KEY = "email:failed"   # LIST – dead jobs after MAX_RETRY attempts
SENT_KEY   = "email:sent"     # LIST – successfully sent log (capped)
MAX_RETRY  = 3
LIST_MAX   = 100              # cap for all three lists


async def _log_sent(redis_client, job: dict) -> None:
    """Push to email:sent log, keep only the latest LIST_MAX entries."""
    import datetime
    job_copy = dict(job)
    job_copy["sent_at"] = datetime.datetime.utcnow().isoformat()
    # Remove raw data payload to keep memory small — we only need metadata
    job_copy.pop("data", None)
    await redis_client.rpush(SENT_KEY, json.dumps(job_copy))
    await redis_client.ltrim(SENT_KEY, -LIST_MAX, -1)


async def queue_email(email_type: str, to: str, data: dict) -> None:
    """
    Try to send email instantly.
    If SMTP fails, push to Redis queue for the worker to retry (up to MAX_RETRY times).
    """
    from app.core.redis import cache_email
    import datetime

    job = {
        "type": email_type,
        "to": to,
        "data": data,
        "attempt": 1,
        "created_at": datetime.datetime.utcnow().isoformat(),
    }

    # ── 1. Try instant send ────────────────────────────────────────────────────
    success = await send_queued_job(job)

    if success:
        logger.info(f"[Email] Sent instantly: {email_type} → {to}")
        await _log_sent(cache_email.client, job)
        return

    # ── 2. Instant send failed → push to Redis for retry ──────────────────────
    logger.warning(f"[Email] Instant send failed, queuing for retry: {email_type} → {to}")
    try:
        await cache_email.client.rpush(QUEUE_KEY, json.dumps(job))
    except Exception as exc:
        logger.error(f"[Email] Failed to push to Redis queue: {email_type} → {to}: {exc}")


async def send_queued_job(job: dict) -> bool:
    """
    Called both by queue_email (instant attempt) and the worker (retries).
    Builds and sends the email for a job dict.
    Returns True on success, False on failure.
    """
    t    = job.get("type")
    to   = job.get("to", "")
    data = job.get("data", {})

    if t == "order_confirmation":
        return await _send_order_confirmation(
            to=to,
            name=data["name"],
            order_number=data["order_number"],
            items=data["items"],
            total=data["total"],
            payment_method=data["payment_method"],
        )
    elif t == "payment_failed":
        return await _send_payment_failed(
            to=to,
            name=data["name"],
            order_number=data["order_number"],
        )
    elif t == "welcome":
        return await send_welcome_email(name=data["name"], email=to)
    elif t == "otp":
        return await send_otp_email(email=to, otp=data["otp"], name=data["name"])
    else:
        logger.warning(f"[Email] Unknown job type: {t}")
        return True   # don't retry unknown types


# ─── Public helpers called from orders.py / webhooks.py ───────────────────────

async def send_order_confirmation_email(
    name: str,
    email: str,
    order_number: str,
    items: List[dict],
    total: float,
    payment_method: str = "online",
) -> None:
    await queue_email(
        email_type="order_confirmation",
        to=email,
        data={
            "name": name,
            "order_number": order_number,
            "items": items,
            "total": total,
            "payment_method": payment_method,
        },
    )


async def send_order_payment_failed_email(
    name: str, email: str, order_number: str
) -> None:
    await queue_email(
        email_type="payment_failed",
        to=email,
        data={"name": name, "order_number": order_number},
    )


# ─── Welcome Email ─────────────────────────────────────────────────────────────

async def send_welcome_email(name: str, email: str) -> bool:
    msg = EmailMessage()
    msg["Subject"] = f"Welcome to Koremobile, {name}! 🎉"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = email

    css = """
.hero{background:#e8f0fe;border-radius:12px;padding:24px 20px;text-align:center;margin-bottom:22px}
.hero-emoji{font-size:36px;margin-bottom:10px}
.hero h2{font-size:22px;font-weight:700;color:#0b3d91;margin-bottom:6px;letter-spacing:-.3px}
.hero p{font-size:14px;color:#4b5563;margin:0}
.feat-list{list-style:none;margin:18px 0 22px;padding:0}
.feat-list li{display:flex;align-items:flex-start;gap:12px;
              padding:14px 0;border-bottom:1px solid #f3f4f6}
.feat-list li:last-child{border-bottom:none}
.feat-icon{width:40px;height:40px;min-width:40px;background:#e8f0fe;border-radius:10px;
           display:flex;align-items:center;justify-content:center;font-size:18px}
.feat-text-title{font-size:14px;font-weight:700;color:#111827;margin-bottom:2px}
.feat-text-desc{font-size:13px;color:#6b7280;line-height:1.5}
"""

    body = f"""
<div class="body">
  <div class="hero">
    <div class="hero-emoji">👋</div>
    <h2>Welcome aboard, {name}!</h2>
    <p>Your account is ready. Let's explore.</p>
  </div>
  <p>We're thrilled to have you join the Koremobile community. Here's what's waiting for you:</p>
  <ul class="feat-list">
    <li>
      <div class="feat-icon">📱</div>
      <div>
        <div class="feat-text-title">Huge Selection</div>
        <div class="feat-text-desc">Thousands of phones &amp; accessories at the best prices</div>
      </div>
    </li>
    <li>
      <div class="feat-icon">🚚</div>
      <div>
        <div class="feat-text-title">Fast Delivery</div>
        <div class="feat-text-desc">Express shipping to your door across India</div>
      </div>
    </li>
    <li>
      <div class="feat-icon">🔒</div>
      <div>
        <div class="feat-text-title">Safe Payments</div>
        <div class="feat-text-desc">100% encrypted &amp; secure checkout every time</div>
      </div>
    </li>
    <li>
      <div class="feat-icon">🛎️</div>
      <div>
        <div class="feat-text-title">24/7 Support</div>
        <div class="feat-text-desc">Our team is always here when you need help</div>
      </div>
    </li>
  </ul>
  <a href="{settings.FRONTEND_URL}" class="btn">Start Shopping →</a>
  <hr>
  <p class="sig">Warm regards,<br><strong>The Koremobile Team</strong></p>
</div>
"""
    html = _shell(css, body, preview=f"Hi {name}, your Koremobile account is ready!")
    msg.add_alternative(html, subtype="html")
    return await _send_email(msg)


# ─── OTP Email ─────────────────────────────────────────────────────────────────

async def send_otp_email(email: str, otp: str, name: str) -> bool:
    msg = EmailMessage()
    msg["Subject"] = "Your Koremobile Login Code"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = email

    digit_boxes = "".join(
        f'<span style="display:inline-block;width:42px;height:52px;line-height:52px;'
        f'background:#e8f0fe;border:1.5px solid #93c5fd;border-radius:10px;'
        f'font-size:26px;font-weight:700;color:#0b3d91;text-align:center;'
        f'font-family:monospace;margin:0 4px">{d}</span>'
        for d in otp
    )

    css = """
.otp-card{background:#f0f7ff;border:1px solid #bfdbfe;border-radius:14px;
          padding:28px 20px;text-align:center;margin:22px 0}
.otp-label{font-size:12px;font-weight:700;color:#3b82f6;letter-spacing:1.5px;
           text-transform:uppercase;margin-bottom:16px}
.otp-digits{margin-bottom:16px;line-height:1}
.otp-expiry{display:inline-flex;align-items:center;gap:6px;background:#fff;
            border:1px solid #e5e7eb;border-radius:30px;padding:7px 16px;
            font-size:13px;font-weight:600;color:#6b7280}
.warn{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;
      padding:14px 16px;font-size:13px;color:#92400e;line-height:1.6;margin-top:4px}
"""

    body = f"""
<div class="body">
  <p class="greeting">Hi {name},</p>
  <p>Here's your one-time login code. It expires in <strong>10 minutes</strong>.</p>
  <div class="otp-card">
    <div class="otp-label">Your Login Code</div>
    <div class="otp-digits">{digit_boxes}</div>
    <div class="otp-expiry">⏱ Expires in 10 minutes</div>
  </div>
  <div class="warn">
    🔒 <strong>Never share this code.</strong> Koremobile will never call or message
    you asking for it. If you didn't request this, you can safely ignore this email.
  </div>
  <hr>
  <p class="sig">Stay safe,<br><strong>The Koremobile Team</strong></p>
</div>
"""
    html = _shell(css, body, preview=f"Your Koremobile code: {otp} (expires in 10 min)")
    msg.add_alternative(html, subtype="html")
    return await _send_email(msg)


# ─── Order Confirmation (COD + Online) ────────────────────────────────────────
# payment_method="cod"    → shows Cash on Delivery badge + pay-on-delivery note
# payment_method="online" → shows Online Payment Successful badge

async def _send_order_confirmation(
    to: str,
    name: str,
    order_number: str,
    items: List[dict],
    total: float,
    payment_method: str = "online",
) -> bool:
    msg = EmailMessage()
    msg["Subject"] = f"Order Confirmed ✅ #{order_number}"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to

    item_rows = ""
    for i in items:
        item_rows += f"""
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:13px 0;border-bottom:1px solid #f3f4f6;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;color:#111827;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              {i['name']}
            </div>
            <div style="font-size:12px;color:#9ca3af;margin-top:2px">Qty: {i.get('qty', 1)}</div>
          </div>
          <div style="font-size:15px;font-weight:700;color:#111827;white-space:nowrap">
            ₹{i.get('price', 0):,.0f}
          </div>
        </div>"""

    if payment_method == "cod":
        payment_badge = """
          <span style="display:inline-flex;align-items:center;gap:6px;background:#fef3c7;
                       color:#92400e;font-size:13px;font-weight:700;padding:7px 14px;
                       border-radius:30px">
            💵 Cash on Delivery
          </span>"""
        payment_row_value = '<span style="font-weight:700;color:#d97706">Cash on Delivery</span>'
        payment_note = f"""
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;
                      padding:16px 18px;margin:18px 0;font-size:14px;color:#92400e;line-height:1.75">
            💵 <strong>Pay ₹{total:,.0f} when your order arrives.</strong><br>
            Please keep the exact amount ready at the time of delivery.
            Our delivery partner will collect payment.
          </div>"""
    else:
        payment_badge = """
          <span style="display:inline-flex;align-items:center;gap:6px;background:#d1fae5;
                       color:#065f46;font-size:13px;font-weight:700;padding:7px 14px;
                       border-radius:30px">
            ✅ Payment Successful
          </span>"""
        payment_row_value = '<span style="font-weight:700;color:#059669">✓ Online — Paid</span>'
        payment_note = ""

    css = """
.meta-card{background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;
           padding:16px 18px;margin:20px 0}
.meta-row{display:flex;justify-content:space-between;align-items:center;
          padding:8px 0;border-bottom:1px solid #f3f4f6}
.meta-row:last-child{border-bottom:none;padding-bottom:0}
.meta-label{font-size:13px;color:#6b7280}
.meta-value{font-size:13px;color:#111827}
.items-block{margin:4px 0 16px}
.total-row{display:flex;justify-content:space-between;align-items:center;
           background:#e8f0fe;border-radius:10px;padding:14px 16px;margin-top:4px}
.total-label{font-size:14px;font-weight:600;color:#1e40af}
.total-amount{font-size:18px;font-weight:700;color:#0b3d91}
"""

    body = f"""
<div class="body">
  <div style="margin-bottom:18px">✅ Order Confirmed &nbsp;{payment_badge}</div>
  <p class="greeting">Thank you, {name}!</p>
  <p>Your order is confirmed and being processed. You'll get a shipping update soon.</p>

  <div class="meta-card">
    <div class="meta-row">
      <span class="meta-label">Order Number</span>
      <span class="meta-value" style="color:#0b3d91;font-weight:700">#{order_number}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Payment</span>
      <span class="meta-value">{payment_row_value}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Est. Delivery</span>
      <span class="meta-value" style="font-weight:600">3–5 Business Days</span>
    </div>
  </div>

  {payment_note}

  <div class="items-block">{item_rows}</div>
  <div class="total-row">
    <span class="total-label">Order Total</span>
    <span class="total-amount">₹{total:,.0f}</span>
  </div>

  <a href="{settings.FRONTEND_URL}/orders/{order_number}" class="btn">Track Your Order →</a>

  <hr>
  <p class="sig">Thank you for shopping with us,<br><strong>The Koremobile Team</strong></p>
</div>
"""
    preview = (
        f"Order #{order_number} confirmed — pay ₹{total:,.0f} on delivery"
        if payment_method == "cod"
        else f"Order #{order_number} confirmed — thank you, {name}!"
    )
    html = _shell(css, body, preview=preview)
    msg.add_alternative(html, subtype="html")
    return await _send_email(msg)


# ─── Payment Failed Email ──────────────────────────────────────────────────────

async def _send_payment_failed(to: str, name: str, order_number: str) -> bool:
    msg = EmailMessage()
    msg["Subject"] = f"Payment Failed for Order #{order_number}"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to

    css = """
.failed-badge{display:inline-flex;align-items:center;gap:6px;background:#fee2e2;
              color:#991b1b;font-size:13px;font-weight:700;padding:7px 16px;
              border-radius:30px;margin-bottom:18px}
.info-card{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;
           padding:16px 18px;margin:20px 0;font-size:14px;color:#92400e;line-height:1.7}
"""

    body = f"""
<div class="body">
  <span class="failed-badge">❌ Payment Failed</span>
  <p class="greeting">Hi {name},</p>
  <p>Unfortunately, the payment for order <strong>#{order_number}</strong> could not be processed.</p>
  <div class="info-card">
    ℹ️ <strong>No money has been deducted.</strong> If any amount was held,
    it will be automatically reversed within 5–7 business days by your bank.
  </div>
  <p>You can place the order again using a different payment method or retry with the same one.</p>
  <a href="{settings.FRONTEND_URL}/cart" class="btn">Go Back to Cart →</a>
  <hr>
  <p class="sig">We're sorry for the inconvenience,<br><strong>The Koremobile Team</strong></p>
</div>
"""
    html = _shell(css, body, preview=f"Payment failed for order #{order_number} — no money was deducted")
    msg.add_alternative(html, subtype="html")
    return await _send_email(msg)