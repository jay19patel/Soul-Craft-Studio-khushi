import nodemailer from 'nodemailer';
import { getDb } from './db';
import { generateInvoicePdf } from './pdf';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const DEFAULT_FROM_EMAIL = process.env.DEFAULT_FROM_EMAIL || 'info@soulcraftstudio.in';

let transporter = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
    console.log('Nodemailer SMTP transporter configured.');
  } catch (e) {
    console.error('Failed to configure SMTP transporter:', e);
  }
} else {
  console.warn('SMTP credentials missing. Emails will be logged to database and console only.');
}

function getFormattedDate(date = new Date()) {
  return date.toISOString();
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Creates an outbox log entry in the MongoDB collection 'emaillogs'.
 */
async function logEmailAttempt({ email_type, subject, body_html, to_email, user_id, order_id, status, error_message = '', attachment_name = '', attachment_data = null }) {
  try {
    const db = await getDb();
    const now = getFormattedDate();
    const body_text = stripHtml(body_html);
    
    const logDoc = {
      email_type,
      status,
      subject,
      from_email: DEFAULT_FROM_EMAIL,
      to_email,
      body_text,
      body_html,
      backend: transporter ? 'smtp' : 'simulated',
      attachment_name,
      attachment_mimetype: attachment_name ? 'application/pdf' : '',
      attachment_data: attachment_data ? attachment_data.toString('base64') : null,
      attempts: 1,
      error_message,
      queued_at: now,
      sent_at: status === 'SENT' ? now : null,
      failed_at: status === 'FAILED' ? now : null,
      user_id: user_id ? String(user_id) : null,
      order_id: order_id ? String(order_id) : null
    };
    
    await db.collection('emaillogs').insertOne(logDoc);
  } catch (e) {
    console.error('Failed to write email log to database:', e);
  }
}

/**
 * Send welcome email to a new user.
 */
export async function sendWelcomeEmail(user) {
  const to_email = user.email;
  const subject = `Welcome to Soul Craft Studio - Your account is ready`;
  const body_html = `
    <h2>Welcome to Soul Craft Studio!</h2>
    <p>Hi ${user.full_name || user.username},</p>
    <p>Your account has been successfully created. Enjoy discovering our handcrafted creations.</p>
    <p>Best Regards,<br/>Soul Craft Studio Team</p>
  `;
  
  if (transporter) {
    try {
      await transporter.sendMail({
        from: DEFAULT_FROM_EMAIL,
        to: to_email,
        subject: subject,
        html: body_html
      });
      await logEmailAttempt({ email_type: 'WELCOME', subject, body_html, to_email, user_id: user.id, status: 'SENT' });
    } catch (err) {
      console.error('SMTP welcome email failed:', err);
      await logEmailAttempt({ email_type: 'WELCOME', subject, body_html, to_email, user_id: user.id, status: 'FAILED', error_message: err.message });
    }
  } else {
    console.log(`[Simulated Welcome Email] To: ${to_email} | Subject: ${subject}`);
    await logEmailAttempt({ email_type: 'WELCOME', subject, body_html, to_email, user_id: user.id, status: 'SENT' });
  }
}

/**
 * Send order confirmation email (attaches generated PDF invoice).
 */
export async function sendOrderConfirmationEmail(order) {
  const to_email = order.customer_email;
  if (!to_email) return;
  
  const subject = `Order Confirmed - Invoice #${order.id} | Soul Craft Studio`;
  const body_html = `
    <h2>Thank you for your order!</h2>
    <p>Hi ${order.customer_name || 'Customer'},</p>
    <p>We are excited to let you know that your order <strong>SCS-${order.id}</strong> has been received and is being prepared.</p>
    <p>Please find attached your invoice PDF containing the details of your purchase.</p>
    <p>Shipping Address: ${order.shipping_address}</p>
    <p>Total Amount: Rs. ${Number(order.total_amount).toFixed(2)}</p>
    <p>If you have any questions, feel free to reply to this email.</p>
  `;
  
  let pdfBuffer = null;
  const attachment_name = `Soul-Craft-Studio-Invoice-${order.id}.pdf`;
  
  try {
    pdfBuffer = await generateInvoicePdf(order);
  } catch (pdfErr) {
    console.error('Failed to generate invoice PDF:', pdfErr);
  }
  
  if (transporter && pdfBuffer) {
    try {
      await transporter.sendMail({
        from: DEFAULT_FROM_EMAIL,
        to: to_email,
        subject: subject,
        html: body_html,
        attachments: [{
          filename: attachment_name,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
      await logEmailAttempt({
        email_type: 'ORDER_CONFIRMATION', subject, body_html, to_email,
        user_id: order.user_id, order_id: order.id, status: 'SENT',
        attachment_name, attachment_data: pdfBuffer
      });
    } catch (err) {
      console.error('SMTP order confirmation email failed:', err);
      await logEmailAttempt({
        email_type: 'ORDER_CONFIRMATION', subject, body_html, to_email,
        user_id: order.user_id, order_id: order.id, status: 'FAILED',
        error_message: err.message, attachment_name, attachment_data: pdfBuffer
      });
    }
  } else {
    console.log(`[Simulated Order Confirmation Email] To: ${to_email} | Subject: ${subject}`);
    await logEmailAttempt({
      email_type: 'ORDER_CONFIRMATION', subject, body_html, to_email,
      user_id: order.user_id, order_id: order.id, status: 'SENT',
      attachment_name, attachment_data: pdfBuffer
    });
  }
}

/**
 * Send order status update email.
 */
export async function sendOrderStatusEmail(order) {
  const to_email = order.customer_email;
  if (!to_email) return;
  
  const subject = `Your Order #${order.id} status changed to ${order.status} | Soul Craft Studio`;
  const body_html = `
    <h2>Order Status Update</h2>
    <p>Hi ${order.customer_name || 'Customer'},</p>
    <p>The status of your order <strong>SCS-${order.id}</strong> has been updated to: <strong>${order.status}</strong></p>
    <p>Thank you for shopping with us!</p>
  `;
  
  if (transporter) {
    try {
      await transporter.sendMail({
        from: DEFAULT_FROM_EMAIL,
        to: to_email,
        subject: subject,
        html: body_html
      });
      await logEmailAttempt({ email_type: 'ORDER_STATUS', subject, body_html, to_email, user_id: order.user_id, order_id: order.id, status: 'SENT' });
    } catch (err) {
      console.error('SMTP order status update failed:', err);
      await logEmailAttempt({ email_type: 'ORDER_STATUS', subject, body_html, to_email, user_id: order.user_id, order_id: order.id, status: 'FAILED', error_message: err.message });
    }
  } else {
    console.log(`[Simulated Status Email] To: ${to_email} | Status: ${order.status}`);
    await logEmailAttempt({ email_type: 'ORDER_STATUS', subject, body_html, to_email, user_id: order.user_id, order_id: order.id, status: 'SENT' });
  }
}

/**
 * Send payment status update email.
 */
export async function sendPaymentStatusEmail(order) {
  const to_email = order.customer_email;
  if (!to_email) return;
  
  const subject = `Payment Status Updated for Order #${order.id} | Soul Craft Studio`;
  const body_html = `
    <h2>Payment Status Update</h2>
    <p>Hi ${order.customer_name || 'Customer'},</p>
    <p>We have updated the payment status of your order <strong>SCS-${order.id}</strong> to: <strong>${order.payment_status}</strong></p>
    <p>Thank you for shopping with us!</p>
  `;
  
  if (transporter) {
    try {
      await transporter.sendMail({
        from: DEFAULT_FROM_EMAIL,
        to: to_email,
        subject: subject,
        html: body_html
      });
      await logEmailAttempt({ email_type: 'PAYMENT_STATUS', subject, body_html, to_email, user_id: order.user_id, order_id: order.id, status: 'SENT' });
    } catch (err) {
      console.error('SMTP payment status update failed:', err);
      await logEmailAttempt({ email_type: 'PAYMENT_STATUS', subject, body_html, to_email, user_id: order.user_id, order_id: order.id, status: 'FAILED', error_message: err.message });
    }
  } else {
    console.log(`[Simulated Payment Email] To: ${to_email} | Payment Status: ${order.payment_status}`);
    await logEmailAttempt({ email_type: 'PAYMENT_STATUS', subject, body_html, to_email, user_id: order.user_id, order_id: order.id, status: 'SENT' });
  }
}
