import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { recordId } = await request.json();

    if (!recordId) {
      return Response.json(
        { error: 'Record ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Query the current status from Supabase
    const { data, error } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error) {
      console.error('[v0] Supabase query error:', error);
      return Response.json(
        { error: 'Failed to fetch OTP status' },
        { status: 500 }
      );
    }

    return Response.json({
      status: data.status, // 'pending', 'verified', or 'denied'
      data,
    });
  } catch (error) {
    console.error('[v0] Error checking OTP status:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
