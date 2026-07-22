import nodemailer from "nodemailer";

/**
 * Sends an email notification to the admin when a new notice is processed.
 * Requires EMAIL_USER and EMAIL_APP_PASSWORD environment variables.
 */
export async function sendAdminNotification(
  noticeTitle: string,
  noticeId: string,
  whatsappMessage: string
): Promise<void> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_APP_PASSWORD;
  
  const users = process.env.EMAIL_USERS ;

  if (!emailUser || !emailPass) {
    console.warn("⚠️ Email credentials not configured. Skipping email notification.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/notices`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

    const mailOptions = {
      from: `"MMMUT Notice Bot" <${emailUser}>`,
      to: users ? `${emailUser}, ${users}` : emailUser, // Send to admin and any additional users
      subject: `🚨 New Notice Ready for Review: ${noticeTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2e7d32;">New Notice Processed</h2>
          <p>The AI pipeline has successfully processed a new notice:</p>
          <blockquote style="border-left: 4px solid #1976d2; padding-left: 10px; margin-left: 0; font-style: italic;">
            <strong>${noticeTitle}</strong>
          </blockquote>
          
          <h3 style="color: #333; margin-top: 20px;">Generated WhatsApp Message:</h3>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-family: monospace;">
${whatsappMessage}
          </div>

          <p style="margin-top: 20px;">It is currently saved as a <strong>draft</strong>.</p>
          <p>Please review and publish it to the WhatsApp channel.</p>
          <div style="margin-top: 20px;">
            <a href="${whatsappUrl}" style="display: inline-block; background-color: #25D366; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-right: 10px; font-weight: bold;">
              📱 Send to WhatsApp
            </a>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #1976d2; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Go to Admin Dashboard
            </a>
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #757575;">
            Automated message from the MMMUT Notice Intelligence Platform
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Admin notification email sent for notice: ${noticeTitle}`);
  } catch (error) {
    console.error("❌ Failed to send admin notification email:", error);
  }
}

/**
 * Sends an email notification to the admin when the AI pipeline fails.
 */
export async function sendFailureNotification(
  errorDetails: string,
  noticeId?: string
): Promise<void> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_APP_PASSWORD;
  const users = process.env.EMAIL_USERS;

  if (!emailUser || !emailPass) {
    console.warn("⚠️ Email credentials not configured. Skipping failure notification.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/notices`;

    const mailOptions = {
      from: `"MMMUT Notice Bot" <${emailUser}>`,
      to: users ? `${emailUser}, ${users}` : emailUser,
      subject: `⚠️ AI Processing Failed! Manual intervention required`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #d32f2f;">Pipeline Failure</h2>
          <p>The AI pipeline encountered an error while trying to process a newly scraped notice.</p>
          
          <h3 style="color: #333; margin-top: 20px;">Error Details:</h3>
          <div style="background-color: #ffebee; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-family: monospace; color: #b71c1c; border: 1px solid #ffcdd2;">
${errorDetails}
          </div>

          <p style="margin-top: 20px;">The processing job is stuck in the pending state.</p>
          <p>Please go to the dashboard to manually process this notice.</p>
          
          <div style="margin-top: 20px;">
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #d32f2f; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Open Admin Dashboard
            </a>
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #757575;">
            Automated alert from the MMMUT Notice Intelligence Platform
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Admin failure notification email sent.`);
  } catch (error) {
    console.error("❌ Failed to send failure notification email:", error);
  }
}

/**
 * Sends a 1-day advance warning for upcoming deadlines.
 */
export async function sendDeadlineAlert(
  deadlineTitle: string,
  deadlineDate: string,
  deadlineCategory: string,
  deadlineDescription: string | null
): Promise<void> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_APP_PASSWORD;
  const users = process.env.EMAIL_USERS;

  if (!emailUser || !emailPass) {
    console.warn("⚠️ Email credentials not configured. Skipping deadline alert.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const whatsappMessage = `🚨 *REMINDER: Upcoming Deadline Tomorrow!* 🚨

*${deadlineTitle}*
Date: ${deadlineDate}
${deadlineDescription ? `\nDetails: ${deadlineDescription}` : ''}

Please make sure to complete this process by tomorrow to avoid any issues.
- MMMUT Notice Intelligence Platform`;

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/deadlines`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

    const mailOptions = {
      from: `"MMMUT Notice Bot" <${emailUser}>`,
      to: users ? `${emailUser}, ${users}` : emailUser,
      subject: `🚨 DEADLINE TOMORROW: ${deadlineTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #d32f2f;">Deadline Alert: Tomorrow!</h2>
          <p>This is an automated 1-day advance warning for the following deadline:</p>
          <blockquote style="border-left: 4px solid #f57c00; padding-left: 10px; margin-left: 0;">
            <strong>${deadlineTitle}</strong><br/>
            Date: ${deadlineDate}<br/>
            Category: ${deadlineCategory}
          </blockquote>
          
          <h3 style="color: #333; margin-top: 20px;">Generated WhatsApp Message:</h3>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-family: monospace;">
${whatsappMessage}
          </div>

          <p>Please share this reminder to the student WhatsApp channels.</p>
          <div style="margin-top: 20px;">
            <a href="${whatsappUrl}" style="display: inline-block; background-color: #25D366; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-right: 10px; font-weight: bold;">
              📱 Send to WhatsApp
            </a>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #1976d2; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              View Deadlines Dashboard
            </a>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Deadline alert email sent for: ${deadlineTitle}`);
  } catch (error) {
    console.error("❌ Failed to send deadline alert email:", error);
  }
}

/**
 * Sends the generated short reminder message to the admin via email.
 */
export async function sendShortReminderEmail(
  promptText: string,
  whatsappMessage: string
): Promise<void> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_APP_PASSWORD;
  const users = process.env.EMAIL_USERS;

  if (!emailUser || !emailPass) {
    console.warn("⚠️ Email credentials not configured. Skipping short reminder email.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

    const mailOptions = {
      from: `"MMMUT Notice Bot" <${emailUser}>`,
      to: users ? `${emailUser}, ${users}` : emailUser,
      subject: `🚨 Generated Short Reminder Ready`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2e7d32;">Short Reminder Generated</h2>
          <p>You generated a short reminder using the Groq API from the following prompt:</p>
          <blockquote style="border-left: 4px solid #1976d2; padding-left: 10px; margin-left: 0; font-style: italic;">
            <strong>${promptText}</strong>
          </blockquote>
          
          <h3 style="color: #333; margin-top: 20px;">Generated WhatsApp Message:</h3>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-family: monospace;">
${whatsappMessage}
          </div>

          <div style="margin-top: 20px;">
            <a href="${whatsappUrl}" style="display: inline-block; background-color: #25D366; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-right: 10px; font-weight: bold;">
              📱 Send to WhatsApp
            </a>
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #757575;">
            Automated message from the MMMUT Notice Intelligence Platform
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Short reminder email sent.`);
  } catch (error) {
    console.error("❌ Failed to send short reminder email:", error);
  }
}
