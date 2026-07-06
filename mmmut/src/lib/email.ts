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
