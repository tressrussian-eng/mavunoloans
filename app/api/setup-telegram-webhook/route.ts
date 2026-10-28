export async function GET() {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const baseUrl = process.env.TELEGRAM_WEBHOOK_URL
      ? process.env.TELEGRAM_WEBHOOK_URL
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    if (!botToken) {
      return Response.json(
        { error: 'Telegram bot token not configured' },
        { status: 500 }
      );
    }

    const webhookUrl = `${baseUrl}/api/telegram-webhook`;

    console.log('[v0] Setting up webhook at:', webhookUrl);

    // First, delete any existing webhook
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true }),
    });

    // Set the new webhook
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['callback_query'],
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('[v0] Telegram webhook setup error:', data);
      return Response.json(
        { error: 'Failed to setup webhook', details: data },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: 'Telegram webhook configured successfully',
      webhook_url: webhookUrl,
      info: data.result,
    });
  } catch (error) {
    console.error('[v0] Webhook setup error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
