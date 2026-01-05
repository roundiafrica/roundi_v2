/**
 * POST /api/drivers/auth/request-otp
 * 
 * Initiates OTP flow for driver authentication
 * Accepts phone number, validates it, checks if driver exists,
 * and sends OTP via Supabase auth
 * 
 * Rate limited to 3 requests per phone per 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase-server';
import {
  validateAndNormalizePhone,
  isValidPhoneNumber,
} from '@/lib/phone-validation';
import { otpRateLimiter } from '@/lib/rate-limiter';
import {
  OtpException,
  OtpErrorCode,
  getOtpErrorMessage,
  type RequestOtpRequest,
  type RequestOtpResponse,
  type OtpErrorResponse,
} from '@/lib/otp-types';

/**
 * Handle OTP request
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: RequestOtpRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_PHONE),
          code: OtpErrorCode.INVALID_PHONE,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    const { phone: rawPhone } = body;

    // Validate phone format
    if (!isValidPhoneNumber(rawPhone)) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_PHONE),
          code: OtpErrorCode.INVALID_PHONE,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Normalize phone to E.164 format
    const phone = validateAndNormalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_PHONE),
          code: OtpErrorCode.INVALID_PHONE,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Check rate limit
    const rateLimitKey = `otp_request:${phone}`;
    if (!otpRateLimiter.isAllowed(rateLimitKey)) {
      const resetTime = otpRateLimiter.getResetTime(rateLimitKey);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.RATE_LIMIT_EXCEEDED),
          code: OtpErrorCode.RATE_LIMIT_EXCEEDED,
          retryAfter: resetTime,
        } as OtpErrorResponse,
        {
          status: 429,
          headers: {
            'Retry-After': resetTime.toString(),
          },
        }
      );
    }

    // Check if driver exists with this phone
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, name, status, phone_verified_at')
      .eq('phone', phone)
      .maybeSingle();

    if (driverError && driverError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is expected
      console.error('[request-otp] Database error checking driver:', driverError);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    if (!driver) {
      // Return generic message to prevent phone enumeration
      console.warn(
        `[request-otp] Phone number not registered in drivers table: ${phone}`
      );
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.PHONE_NOT_REGISTERED),
          code: OtpErrorCode.PHONE_NOT_REGISTERED,
        } as OtpErrorResponse,
        { status: 404 }
      );
    }

    // If driver is inactive, still send OTP (they can activate on first login)
    // but we can optionally warn them
    const isInactive =
      driver.status !== 'active' && driver.status !== 'on_break';

    // Request OTP from Supabase
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (otpError) {
      console.error('[request-otp] Supabase OTP error:', otpError);

      // Handle specific Supabase errors
      if (otpError.message.includes('rate limited')) {
        return NextResponse.json(
          {
            error: getOtpErrorMessage(OtpErrorCode.RATE_LIMIT_EXCEEDED),
            code: OtpErrorCode.RATE_LIMIT_EXCEEDED,
          } as OtpErrorResponse,
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.SUPABASE_ERROR),
          code: OtpErrorCode.SUPABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    const remainingAttempts = otpRateLimiter.getRemainingAttempts(
      rateLimitKey
    );

    const response: RequestOtpResponse = {
      success: true,
      message: `OTP sent to ${phone}`,
      attemptsRemaining: remainingAttempts,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[request-otp] Unexpected error:', error);
    return NextResponse.json(
      {
        error: getOtpErrorMessage(OtpErrorCode.SUPABASE_ERROR),
        code: OtpErrorCode.SUPABASE_ERROR,
      } as OtpErrorResponse,
      { status: 500 }
    );
  }
}
