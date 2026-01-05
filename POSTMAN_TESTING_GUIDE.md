# Testing Driver OTP with Postman

## Quick Start (5 minutes)

### 1. Import the Collection

1. Open Postman
2. Click **Import** (top left)
3. Select **Upload Files**
4. Choose `Roundi_Driver_OTP.postman_collection.json`
5. Click **Import**

You should now see the "Driver OTP Authentication" collection with all endpoints.

### 2. Set Base URL

1. Click on the collection name: **Driver OTP Authentication**
2. Go to **Variables** tab
3. Set `base_url` to your server URL:
   - **Local development:** `http://localhost:3000`
   - **Production:** `https://your-domain.com`
4. Click **Save**

### 3. Create Test Driver

Run this SQL in your Supabase SQL Editor:

```sql
INSERT INTO drivers (name, phone, email, vehicle_type, license_number, org_id, status)
VALUES ('Test Driver', '+1234567890', 'test@example.com', 'van', 'DL123456', 1, 'pending_activation')
ON CONFLICT (phone) DO UPDATE SET status = 'pending_activation';
```

### 4. Test Full Workflow

Follow the "End-to-End Workflow" folder in Postman:

1. **Step 1:** Request OTP for `+1234567890`
2. **Step 2:** Get OTP code from Supabase logs or SMS
3. **Step 3:** Verify OTP with the code
4. **Step 4:** Check database to confirm login worked

---

## Detailed Test Scenarios

### Request OTP Endpoint

#### ✅ Test 1: Valid Phone
```
POST /api/drivers/auth/request-otp
{
  "phone": "+1234567890"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to +1234567890",
  "attemptsRemaining": 2
}
```

**What to check:**
- Status code is 200
- `success` is true
- `attemptsRemaining` shows remaining attempts (max 3 per 5 min)

---

#### ✅ Test 2: Different Phone Format
```
POST /api/drivers/auth/request-otp
{
  "phone": "1 (234) 567-8900"
}
```

**Expected Response (200):**
- Phone gets normalized to `+12345678900`
- OTP is sent successfully

**What to check:**
- Status code is 200
- Message confirms normalized phone format

---

#### ❌ Test 3: Invalid Phone Format
```
POST /api/drivers/auth/request-otp
{
  "phone": "abc123"
}
```

**Expected Response (400):**
```json
{
  "error": "Please enter a valid phone number.",
  "code": "INVALID_PHONE"
}
```

**What to check:**
- Status code is 400
- Error code is `INVALID_PHONE`
- Error message is user-friendly (doesn't reveal implementation details)

---

#### ❌ Test 4: Phone Not Registered
```
POST /api/drivers/auth/request-otp
{
  "phone": "+9999999999"
}
```

**Expected Response (404):**
```json
{
  "error": "This phone number is not registered. Please contact your administrator.",
  "code": "PHONE_NOT_REGISTERED"
}
```

**What to check:**
- Status code is 404
- Error doesn't reveal if phone exists (prevents enumeration)

---

#### ⚠️ Test 5: Rate Limit (Request 3+ times)

Make the **same request 3 times in quick succession**:

```
POST /api/drivers/auth/request-otp
{
  "phone": "+1234567890"
}
```

**After 3rd request, you should get (429):**
```json
{
  "error": "Too many OTP requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 285
}
```

**What to check:**
- First 2 requests return 200 (success)
- 3rd request returns 429
- Response includes `retryAfter` (seconds to wait)
- Headers include `Retry-After` header

---

### Verify OTP Endpoint

#### ✅ Test 6: Correct OTP Code

```
POST /api/drivers/auth/verify-otp
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

Replace `123456` with the actual code from Supabase logs.

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "isFirstLogin": true,
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "sbr_...",
    "expires_in": 3600,
    "expires_at": 1704067200
  },
  "driver": {
    "id": 1,
    "name": "Test Driver",
    "phone": "+1234567890",
    "status": "active",
    "phone_verified_at": "2026-01-05T10:30:00.000Z",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    ...
  }
}
```

**What to check:**
- Status code is 200
- `success` is true
- `session.access_token` is returned (JWT token)
- `driver.status` changed to `active` (auto-activated)
- `driver.phone_verified_at` is set
- `driver.user_id` is populated
- `isFirstLogin` is true (for first login)

---

#### ❌ Test 7: Incorrect OTP Code

```
POST /api/drivers/auth/verify-otp
{
  "phone": "+1234567890",
  "otp": "000000"
}
```

**Expected Response (400):**
```json
{
  "error": "Invalid OTP code. Please check and try again.",
  "code": "INVALID_OTP"
}
```

---

#### ❌ Test 8: Expired OTP

```
POST /api/drivers/auth/verify-otp
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

Wait 10+ minutes after requesting OTP, then verify.

**Expected Response (400):**
```json
{
  "error": "OTP code has expired. Please request a new one.",
  "code": "EXPIRED_OTP"
}
```

---

#### ❌ Test 9: Unregistered Phone

```
POST /api/drivers/auth/verify-otp
{
  "phone": "+9999999999",
  "otp": "123456"
}
```

**Expected Response (404):**
```json
{
  "error": "This phone number is not registered. Please contact your administrator.",
  "code": "PHONE_NOT_REGISTERED"
}
```

---

## How to Get the OTP Code for Testing

### Option 1: Supabase Logs (Development)

1. Open Supabase Dashboard
2. Go to **Logs** or **Realtime** section
3. Search for your phone number or "OTP"
4. Find the SMS/email with the code

Example log entry:
```
Sending SMS to +1234567890
Code: 123456
```

### Option 2: SMS Inbox (Real SMS Provider)

If you configured Twilio/AWS SNS/etc:
1. Check your phone's SMS messages
2. Look for message from Supabase
3. Copy the 6-digit code

### Option 3: Inbucket (Local Development)

If running Supabase locally with Docker:
1. Go to `http://localhost:54324/`
2. Look for OTP emails/SMS
3. Copy the code

### Option 4: Supabase Auth Users

1. Go to Supabase > Authentication > Users
2. Check user's last sign-in activity
3. OTP details may be visible in logs

---

## Testing Checklist

Use this checklist to verify all functionality:

### Request OTP Tests
- [ ] **Valid phone:** Returns 200 with "OTP sent"
- [ ] **Format normalization:** Works with `+1234567890`, `1234567890`, `(123) 456-7890`
- [ ] **Invalid phone:** Returns 400 with `INVALID_PHONE`
- [ ] **Unregistered phone:** Returns 404 with generic message
- [ ] **Rate limiting:** 3 requests ✓, 4th request ✗ (429)
- [ ] **Empty phone:** Returns 400
- [ ] **Attempts remaining:** Count decreases with each request

### Verify OTP Tests
- [ ] **Correct code:** Returns 200 with session
- [ ] **Incorrect code:** Returns 400 with `INVALID_OTP`
- [ ] **Expired code:** Returns 400 with `EXPIRED_OTP` (wait 10+ min)
- [ ] **Unregistered phone:** Returns 404 with generic message
- [ ] **Empty OTP:** Returns 400

### Database Verification
- [ ] **After successful verification:**
  - [ ] `phone_verified_at` is set
  - [ ] `user_id` is populated
  - [ ] `status` changed from `pending_activation` to `active`
  - [ ] Driver record matches session user_id

### Security Checks
- [ ] **Error messages don't leak info:** "Not registered" uses generic message
- [ ] **Rate limit header present:** `Retry-After` header included
- [ ] **Session tokens:** Valid JWT format
- [ ] **Role verification:** Only drivers can verify (role must be 'driver')

---

## Using Session Token

After successful verification, use the `access_token` for authenticated requests:

```
GET /api/drivers/me
Authorization: Bearer <access_token>
```

Example in Postman:
1. Copy `session.access_token` from verify response
2. Click **Drivers** > **Get Driver Info** request
3. Go to **Authorization** tab
4. Select type: **Bearer Token**
5. Paste the token in the token field
6. Send request

---

## Common Issues & Solutions

### "Invalid phone format"
- Make sure phone has at least 7 digits
- Use format: `+1234567890` (with or without formatting is OK)

### "Phone not registered"
- Create driver in database with INSERT statement (see above)
- Verify phone in DB matches exactly
- Check if using organization filtering (org_id match)

### "Rate limit exceeded"
- Wait for `retryAfter` seconds
- Or restart your server to reset in-memory rate limiter
- In production, wait the full 5 minutes

### Can't find OTP code
- Check Supabase logs
- Verify SMS provider is configured
- Check browser console for errors
- Look in spam/SMS inbox

### OTP returns "not a driver"
- Verify user in Supabase auth.users has `user_metadata.role = 'driver'`
- This is set by Supabase when creating the auth user

### Session token not working
- Ensure token is pasted correctly (no extra spaces)
- Token should start with "ey..."
- Check token hasn't expired (expires_at field)

---

## Advanced Testing

### Test Multiple Drivers

Create multiple test drivers:

```sql
INSERT INTO drivers (name, phone, email, vehicle_type, license_number, org_id, status)
VALUES 
  ('Driver 1', '+1111111111', 'driver1@example.com', 'van', 'DL111111', 1, 'pending_activation'),
  ('Driver 2', '+2222222222', 'driver2@example.com', 'truck', 'DL222222', 1, 'pending_activation'),
  ('Driver 3', '+3333333333', 'driver3@example.com', 'car', 'DL333333', 1, 'pending_activation');
```

Then test each phone number independently.

### Test Different Organizations

Create drivers in different organizations:

```sql
INSERT INTO drivers (name, phone, email, vehicle_type, license_number, org_id, status)
VALUES 
  ('Driver A', '+1234567890', 'drivera@example.com', 'van', 'DL111111', 1, 'pending_activation'),
  ('Driver B', '+1234567890', 'driverb@example.com', 'van', 'DL222222', 2, 'pending_activation');
```

Each organization gets its own driver with the same phone (if needed).

### Load Testing

Use Postman's **Collection Runner** to test multiple scenarios:

1. Click **...** (three dots) on collection
2. Select **Run collection**
3. Set iterations: 10+
4. Run

---

## Exporting Test Results

After running tests:

1. Click the **...** menu next to collection name
2. Select **Export**
3. Save as JSON
4. Share with team

---

## Tips & Tricks

### Save Response as Variable
In the Verify OTP response, add a test:

```javascript
pm.environment.set("driver_token", pm.response.json().session.access_token);
pm.environment.set("driver_id", pm.response.json().driver.id);
```

Then use `{{driver_token}}` in future requests!

### Auto-refresh URL
Set `base_url` as environment variable:
1. Click **Environments**
2. Create new environment
3. Add variables
4. Select environment before running

### Monitor Response Times
View response time in Postman:
- Look at **Tests** tab results
- Check **Postman Console** (Ctrl+Alt+C)
- Verify API performance

---

## Still Having Issues?

1. Check `DRIVER_OTP_IMPLEMENTATION.md` for complete API docs
2. Review endpoint source code
3. Check Supabase logs for detailed errors
4. Verify database schema has all required columns
5. Ensure SMS provider is configured in Supabase

