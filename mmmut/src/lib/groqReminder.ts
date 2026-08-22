export async function generateGroqReminderMessage(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
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

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "groq/compound-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message?.content;

  if (!message) {
    throw new Error("Groq returned empty response");
  }

  return message.trim();
}
