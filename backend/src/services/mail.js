'use strict';

const config = require('../config');
const microsoft = require('./microsoft');

let transporter = null;
function smtpTransport() {
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      // TLS certificates are always verified (the old code disabled this).
    });
  }
  return transporter;
}

/**
 * Sends an email using the best available channel:
 *   1. Microsoft Graph, as the signed-in student (SSO sessions);
 *   2. the configured SMTP service account, with Reply-To set to the student;
 *   3. otherwise returns { sent: false } so the client can open a pre-filled
 *      mailto: draft in the student's own mail app.
 * The student's password is never needed or stored.
 */
async function sendAsStudent({ session, user, to, subject, html }) {
  if (user.provider === 'microsoft' && session?.state?.ms) {
    await microsoft.sendMail(session.state, { to, subject, html });
    return { sent: true, via: 'microsoft' };
  }
  if (config.smtp.enabled) {
    await smtpTransport().sendMail({
      from: `"Aivancity Hub" <${config.smtp.from}>`,
      to,
      replyTo: `"${user.name.replace(/"/g, '')}" <${user.email}>`,
      subject,
      html,
    });
    return { sent: true, via: 'smtp' };
  }
  return { sent: false, via: 'mailto' };
}

module.exports = { sendAsStudent };
