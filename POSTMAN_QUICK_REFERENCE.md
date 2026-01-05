# Postman Testing - Quick Reference

## Setup (1 minute)

1. **Import Collection:** `Roundi_Driver_OTP.postman_collection.json`
2. **Set Variable:** `base_url` = `http://localhost:3000`
3. **Create Test Driver:** Run SQL in Supabase SQL Editor

```sql
INSERT INTO drivers (name, phone, email, vehicle_type, license_number, org_id, status)
VALUES ('Test Driver', '+1234567890', 'test@example.com', 'van', 'DL123456', 1, 'pending_activation');
```

---

## Full Test Flow (5 minutes)

### 1️⃣ Request OTP
```
POST http://localhost:3000/api/drivers/auth/request-otp

Body:
{
  "phone": "+1234567890"
}

Expected: 200 OK
{
  "success": true,
  "message": "OTP sent to +1234567890",
  "attemptsRemaining": 2
}
```

### 2️⃣ Get OTP Code
- Go to Supabase Dashboard > Logs
- Search for phone number
- Find 6-digit code (e.g., 123456)

### 3️⃣ Verify OTP
```
POST http://localhost:3000/api/drivers/auth/verify-otp

Body:
{
  "phone": "+1234567890",
  "otp": "123456"  ← Use actual code
}

Expected: 200 OK
{
  "success": true,
  "session": {
    "access_token": "eyJ...",
    ...
  },
  "driver": {
    "id": 1,
    "status": "active",
    "phone_verified_at": "2026-01-05T10:30:00Z",
    ...
  }
}
```

### 4️⃣ Verify in Database
```sql
SELECT id, name, phone, phone_verified_at, user_id, status 
FROM drivers 
WHERE phone = '+1234567890';
```

✅ Expected:
- `phone_verified_at`: Now has timestamp
- `user_id`: Now has UUID value
- `status`: Changed to 'active'

---

## Error Testing

### Invalid Phone
```json
{ "phone": "abc123" }
→ 400 INVALID_PHONE
```

### Not Registered
```json
{ "phone": "+9999999999" }
→ 404 PHONE_NOT_REGISTERED
```

### Rate Limited (request 3+ times)
```
1st request: ✅ 200 (attemptsRemaining: 2)
2nd request: ✅ 200 (attemptsRemaining: 1)
3rd request: ✅ 200 (attemptsRemaining: 0)
4th request: ❌ 429 RATE_LIMIT_EXCEEDED
```

### Wrong OTP
```json
{ "phone": "+1234567890", "otp": "000000" }
→ 400 INVALID_OTP
```

### Expired OTP (wait 10+ min)
```json
{ "phone": "+1234567890", "otp": "123456" }
→ 400 EXPIRED_OTP
```

---

## Response Codes

| Code | Endpoint | Meaning |
|------|----------|---------|
| 200 | Both | Success |
| 400 | Both | Invalid input / Expired OTP |
| 404 | Both | Phone not registered |
| 429 | Request | Rate limit exceeded |
| 403 | Verify | Not a driver role |
| 500 | Both | Server error |

---

## Phone Format Examples

All work the same:
- `+1234567890` ✅
- `1234567890` ✅
- `+1 (234) 567-8900` ✅
- `(123) 456-7890` ✅
- `123-456-7890` ✅

All normalize to: `+1234567890`

---

## Error Codes Reference

```
INVALID_PHONE           → Phone format invalid
PHONE_NOT_REGISTERED    → Driver not in database
INVALID_OTP             → Wrong or expired code
EXPIRED_OTP             → Code >10 min old
NOT_A_DRIVER            → User role not 'driver'
RATE_LIMIT_EXCEEDED     → 3+ requests in 5 min
SUPABASE_ERROR          → Auth service error
DATABASE_ERROR          → DB query failed
```

---

## Postman Tips

### Save Access Token
In Verify OTP Tests tab:
```javascript
pm.environment.set("token", pm.response.json().session.access_token);
```

Then use `{{token}}` in other requests.

### Use Collection Variables
1. Click collection name
2. Go to Variables tab
3. Set `base_url` (local or production)
4. All requests auto-update

### Check Response Time
Look at bottom of response panel: "Time: 250ms"

### View Full Response
Click "Pretty" tab for formatted JSON

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Phone not registered" | Create driver in DB (see Setup) |
| "Invalid phone" | Use format: `+1234567890` |
| "Rate limit exceeded" | Wait 5 minutes or restart server |
| Can't find OTP code | Check Supabase Logs section |
| 500 error | Check Supabase is running |
| "Not a driver" | Verify user_metadata has `role: 'driver'` |

---

## Test Cases Checklist

### Request OTP
- [ ] Valid phone → 200
- [ ] Different format → 200 (normalized)
- [ ] Invalid format → 400
- [ ] Unregistered → 404
- [ ] 1st request → 200
- [ ] 2nd request → 200
- [ ] 3rd request → 200
- [ ] 4th request → 429
- [ ] Empty body → 400

### Verify OTP
- [ ] Correct code → 200 + session
- [ ] Wrong code → 400
- [ ] Expired code → 400
- [ ] Unregistered phone → 404
- [ ] Empty OTP → 400
- [ ] Invalid phone format → 400

### Database After Success
- [ ] `phone_verified_at` set ✅
- [ ] `user_id` populated ✅
- [ ] `status` = 'active' ✅

---

## Files You Need

| File | Purpose |
|------|---------|
| `Roundi_Driver_OTP.postman_collection.json` | Import into Postman |
| `POSTMAN_TESTING_GUIDE.md` | Detailed test guide |
| `DRIVER_OTP_IMPLEMENTATION.md` | Full API docs |

---

## One More Thing

After successful OTP verification:

```
Access Token: Copy from response
Refresh Token: Copy from response (optional)
Driver ID: Copy from response
```

Use these for authenticated requests:

```
GET /api/drivers/{{driver_id}}
Authorization: Bearer {{token}}
```

---

**Happy Testing! 🚀**

Need help? Check POSTMAN_TESTING_GUIDE.md for detailed explanations.
