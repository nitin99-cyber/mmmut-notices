const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "mmmut_session" }),
    puppeteer: {
        headless: true, // Docker requires headless
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
    console.log("==========================================");
    console.log("📸 SCAN THE QR CODE ABOVE WITH WHATSAPP!");
    console.log("To scan this, check the docker logs: docker compose logs -f whatsapp");
    console.log("==========================================");
});

client.on('ready', () => {
    console.log('✅ Client is ready! WhatsApp Web is successfully connected.');
});

client.on('auth_failure', msg => {
    console.error('❌ Authentication failure', msg);
});

client.initialize();

const app = express();
app.use(express.json());

// Matches the exact endpoint format of the old OpenWA container
app.post('/api/sendText', async (req, res) => {
    const { args } = req.body;
    
    if (!args || !args.to || !args.content) {
        return res.status(400).json({ error: "Missing 'to' or 'content' in args" });
    }

    try {
        console.log(`Sending message to ${args.to}...`);
        await client.sendMessage(args.to, args.content);
        console.log("Message sent successfully!");
        res.json({ response: "success" });
    } catch(err) {
        console.error("Failed to send message:", err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(2785, '0.0.0.0', () => {
    console.log('🚀 Custom WhatsApp API Gateway running on port 2785');
});
