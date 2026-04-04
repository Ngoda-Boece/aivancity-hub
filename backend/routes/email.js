const express = require('express');
const nodemailer = require('nodemailer');
const { authMiddleware } = require('./auth');

const router = express.Router();

function createTransporter(smtpUser, smtpPass) {
  return nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false }
  });
}

router.post('/booking-email', authMiddleware, async (req, res) => {
  const { roomNumber, roomName, date, startTime, endTime, purpose, participants } = req.body;

  if (!roomName || !date || !startTime || !endTime) {
    return res.status(400).json({ error: 'Room, date, start time, and end time are required' });
  }

  const session = req.sessionData;
  const studentName = session?.user?.name || req.jwtPayload?.name || 'Unknown Student';
  const studentEmail = session?.user?.email || req.jwtPayload?.email || '';
  // Password stored server-side at login — never exposed to frontend
  const studentPassword = session?._smtpPassword;

  const recipient = 'assim.ahmed@aivancity.education';
  const subject = `Room Booking Request — ${roomNumber ? roomNumber + ' — ' : ''}${roomName} — ${date}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 24px; border-radius: 12px;">
      <h2 style="color: #7c3aed; margin-bottom: 8px;">🏫 New Room Booking Request</h2>
      <p style="color: #666; font-size: 14px; margin-bottom: 24px;">Submitted via Aivancity Hub</p>
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <tr style="background: #7c3aed; color: white;">
          <th colspan="2" style="padding: 12px 16px; text-align: left; font-size: 14px;">Booking Details</th>
        </tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #eee; color: #666; font-size: 13px; width: 140px;">Student</td><td style="padding: 12px 16px; border-bottom: 1px solid #eee; font-weight: 600;">${studentName}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">Email</td><td style="padding: 12px 16px; border-bottom: 1px solid #eee;">${studentEmail}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">Room</td><td style="padding: 12px 16px; border-bottom: 1px solid #eee; font-weight: 600;">${roomNumber ? roomNumber + ' — ' : ''}${roomName}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">Date</td><td style="padding: 12px 16px; border-bottom: 1px solid #eee;">${date}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">Time</td><td style="padding: 12px 16px; border-bottom: 1px solid #eee;">${startTime} – ${endTime}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">Purpose</td><td style="padding: 12px 16px; border-bottom: 1px solid #eee;">${purpose || 'Not specified'}</td></tr>
        <tr><td style="padding: 12px 16px; color: #666; font-size: 13px;">Participants</td><td style="padding: 12px 16px;">${participants || 'Not specified'}</td></tr>
      </table>
      <p style="color: #999; font-size: 12px; margin-top: 16px;">Sent automatically via Aivancity Hub. Reply to this email to confirm or decline the booking.</p>
    </div>
  `;

  // Use the logged-in student's aivancity credentials as the SMTP sender
  if (!studentEmail || !studentPassword) {
    console.log('[BookingEmail] No SMTP credentials in session. Would send:', { subject, recipient, studentName });
    return res.json({ ok: true, message: 'Booking request submitted (demo mode — no credentials available)' });
  }

  try {
    const transporter = createTransporter(studentEmail, studentPassword);
    await transporter.sendMail({
      from: `"${studentName}" <${studentEmail}>`,
      to: recipient,
      subject,
      html: htmlBody,
    });
    return res.json({ ok: true, message: 'Booking request sent successfully' });
  } catch (err) {
    console.error('Email send error:', err.message);

    // Office 365 may block SMTP AUTH — give a clear message
    if (err.message?.includes('535') || err.message?.includes('Authentication')) {
      return res.status(502).json({
        error: 'Your aivancity account has SMTP access disabled. Ask IT to enable "SMTP AUTH" for your account, or contact assim.ahmed@aivancity.education directly.'
      });
    }
    return res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }
});

module.exports = router;
