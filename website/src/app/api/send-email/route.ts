import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

// Lazy initialization to avoid build-time errors
let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const ADMIN_EMAIL = 'info@thermodesk.eu';
const FROM_EMAIL = 'ThermoDesk <noreply@thermodesk.eu>';

interface DemoEmailData {
  type: 'demo';
  name: string;
  email: string;
  company?: string;
  phone?: string;
  company_size?: string;
  message?: string;
}

interface ContactEmailData {
  type: 'contact';
  name: string;
  email: string;
  subject?: string;
  message: string;
}

interface NewsletterEmailData {
  type: 'newsletter';
  email: string;
}

type EmailData = DemoEmailData | ContactEmailData | NewsletterEmailData;

export async function POST(request: NextRequest) {
  try {
    const data: EmailData = await request.json();

    switch (data.type) {
      case 'demo':
        await sendDemoEmails(data);
        break;
      case 'contact':
        await sendContactEmails(data);
        break;
      case 'newsletter':
        await sendNewsletterEmail(data);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid email type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

async function sendDemoEmails(data: DemoEmailData) {
  // Admin notification
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Új demó kérés: ${data.name}`,
    html: `
      <h2>Új demó kérés érkezett</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Név:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.name}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.email}</td></tr>
        ${data.company ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Cégnév:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.company}</td></tr>` : ''}
        ${data.phone ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Telefon:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.phone}</td></tr>` : ''}
        ${data.company_size ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Cégméret:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.company_size}</td></tr>` : ''}
        ${data.message ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Üzenet:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.message}</td></tr>` : ''}
      </table>
    `,
  });

  // User confirmation
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: data.email,
    subject: 'Köszönjük demó kérését - ThermoDesk',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Köszönjük, ${data.name}!</h1>
        <p>Megkaptuk demó kérését a ThermoDesk rendszerhez.</p>
        <p>Munkatársunk hamarosan felveszi Önnel a kapcsolatot a megadott elérhetőségeken egy személyre szabott bemutató egyeztetéséhez.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 14px;">
          Üdvözlettel,<br />
          <strong>ThermoDesk csapat</strong>
        </p>
      </div>
    `,
  });
}

async function sendContactEmails(data: ContactEmailData) {
  // Admin notification
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Új üzenet: ${data.subject || 'Kapcsolatfelvétel'}`,
    html: `
      <h2>Új kapcsolatfelvételi üzenet</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Név:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.name}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.email}</td></tr>
        ${data.subject ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Tárgy:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.subject}</td></tr>` : ''}
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Üzenet:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.message}</td></tr>
      </table>
    `,
  });

  // User confirmation
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: data.email,
    subject: 'Megkaptuk üzenetét - ThermoDesk',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Köszönjük, ${data.name}!</h1>
        <p>Megkaptuk üzenetét, munkatársunk hamarosan válaszol.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Üzenete:</strong></p>
          <p style="margin: 8px 0 0 0; white-space: pre-wrap;">${data.message}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 14px;">
          Üdvözlettel,<br />
          <strong>ThermoDesk csapat</strong>
        </p>
      </div>
    `,
  });
}

async function sendNewsletterEmail(data: NewsletterEmailData) {
  // User confirmation only
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: data.email,
    subject: 'Sikeres feliratkozás - ThermoDesk hírlevél',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Köszönjük a feliratkozást!</h1>
        <p>Sikeresen feliratkozott a ThermoDesk hírlevelére.</p>
        <p>Mostantól első kézből értesülhet újdonságainkról, tippjeinkről és exkluzív ajánlatainkról.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 14px;">
          Ha nem Ön iratkozott fel, kérjük hagyja figyelmen kívül ezt az emailt.<br /><br />
          Üdvözlettel,<br />
          <strong>ThermoDesk csapat</strong>
        </p>
      </div>
    `,
  });
}
