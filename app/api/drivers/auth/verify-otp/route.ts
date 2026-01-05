/**
 * POST /api/drivers/auth/verify-otp
 * 
 * Verifies OTP code and completes driver authentication
 * - Verifies OTP with Supabase
 * - Checks user has 'driver' role
 * - Links driver record to auth user
 * - Updates phone_verified_at on first verification
 * - Activates driver on first login (pending_activation -> active)
 * - Returns session and driver info
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateAndNormalizePhone } from '@/lib/phone-validation';
import {
  OtpErrorCode,
  getOtpErrorMessage,
  type VerifyOtpRequest,
  type VerifyOtpResponse,
  type OtpErrorResponse,
} from '@/lib/otp-types';
import {
  completePhoneVerification,
  linkDriverToAuthUser,
  markPhoneAsVerified,
} from '@/lib/otp-driver-auth';

/**
 * Handle OTP verification
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: VerifyOtpRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    const { phone: rawPhone, otp } = body;

    // Validate inputs
    if (!rawPhone || !otp) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Normalize phone
    const phone = validateAndNormalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Verify OTP with Supabase
    const { data: authData, error: otpError } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (otpError) {
      console.error('[verify-otp] OTP verification failed:', otpError);

      // Handle specific OTP errors
      if (
        otpError.message.includes('expired') ||
        otpError.message.includes('Expired')
      ) {
        return NextResponse.json(
          {
            error: getOtpErrorMessage(OtpErrorCode.EXPIRED_OTP),
            code: OtpErrorCode.EXPIRED_OTP,
          } as OtpErrorResponse,
          { status: 400 }
        );
      }

      if (otpError.message.includes('invalid') || otpError.message.includes('Invalid')) {
        return NextResponse.json(
          {
            error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
            code: OtpErrorCode.INVALID_OTP,
          } as OtpErrorResponse,
          { status: 400 }
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

    if (!authData?.user) {
      console.error('[verify-otp] No user returned from OTP verification');
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.SUPABASE_ERROR),
          code: OtpErrorCode.SUPABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    const userId = authData.user.id;
    const userRole = authData.user.user_metadata?.role;

    // Verify user has 'driver' role
    if (userRole !== 'driver') {
      console.warn(
        `[verify-otp] User ${userId} attempted driver login with non-driver role: ${userRole}`
      );
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.NOT_A_DRIVER),
          code: OtpErrorCode.NOT_A_DRIVER,
        } as OtpErrorResponse,
        { status: 403 }
      );
    }

    // Get driver record
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (driverError) {
      console.error('[verify-otp] Error fetching driver:', driverError);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    if (!driver) {
      console.error('[verify-otp] Driver not found for phone:', phone);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.PHONE_NOT_REGISTERED),
          code: OtpErrorCode.PHONE_NOT_REGISTERED,
        } as OtpErrorResponse,
        { status: 404 }
      );
    }

    const isFirstLogin = !driver.user_id;
    const isFirstPhoneVerification = !driver.phone_verified_at;

    // Update driver record:
    // 1. Link to auth user
    // 2. Mark phone as verified (if first time)
    // 3. Activate if pending (if first time)
    const updatedDriver: Record<string, any> = {
      user_id: userId,
    };

    if (isFirstPhoneVerification) {
      updatedDriver.phone_verified_at = new Date().toISOString();
    }

    // Activate driver on first login if they're pending
    if (isFirstLogin && driver.status === 'pending_activation') {
      updatedDriver.status = 'active';
    }

    const { data: updatedDriverData, error: updateError } = await supabase
      .from('drivers')
      .update(updatedDriver)
      .eq('id', driver.id)
      .select()
      .single();

    if (updateError) {
      console.error('[verify-otp] Error updating driver:', updateError);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    const response: VerifyOtpResponse = {
      success: true,
      message: 'Authentication successful',
      session: authData.session || null,
      driver: updatedDriverData,
      isFirstLogin,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[verify-otp] Unexpected error:', error);
    return NextResponse.json(
      {
        error: getOtpErrorMessage(OtpErrorCode.SUPABASE_ERROR),
        code: OtpErrorCode.SUPABASE_ERROR,
      } as OtpErrorResponse,
      { status: 500 }
    );
  }
}
