import { NextRequest, NextResponse } from "next/server";
import { sendShortReminderEmail } from "@/lib/email";
import { getOpenWAConfig, sendWhatsAppText } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GROQ_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const systemInstruction = `You are a helpful assistant for MMMUT (Madan Mohan Malaviya University of Technology). 
The admin will provide you with a short notice or reminder details.
Your job is to format it into a standardized short WhatsApp reminder.

Format strictly as follows:
📢 *MMMUT SHORT REMINDER*

📌 *Notice:* *[Appropriate Title]*

📝 *Details:*
[Clear and concise reminder text based on the provided details]

Do NOT include any extra text, pleasantries, or markdown blocks. Just output the exact template with the brackets replaced with the actual content.`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      throw new Error("Groq returned empty response");
    }

    const finalMessage = message.trim();

    const emailSent = await sendShortReminderEmail(prompt, finalMessage);
    const whatsappConfigured = !!getOpenWAConfig();
    const whatsapp = whatsappConfigured
      ? await sendWhatsAppText(finalMessage)
      : { success: false, error: "OpenWA is not configured" };

    return NextResponse.json({
      success: true,
      message: finalMessage,
      delivery: { email_sent: emailSent, whatsapp_sent: whatsapp.success, whatsapp_error: whatsapp.error },
    });
  } catch (error: any) {
    console.error("Generate reminder error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
