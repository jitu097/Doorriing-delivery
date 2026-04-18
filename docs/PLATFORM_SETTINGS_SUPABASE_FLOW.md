# Platform Settings Handling (Supabase)

This document explains how Platform Settings are read, updated, and stored in Supabase in this project.

## 1) Where platform settings are used

Platform settings control fee-related values such as:
- min_order_amount
- delivery_fee
- convenience_fee
- free_delivery_above

These values are used by:
- Admin panel (to view and update values)
- Public platform endpoint (for checkout-side fee calculation)

## 2) API endpoints involved

### Admin (protected)
- GET /api/admin/settings
  - Returns current platform settings row.
- PUT /api/admin/settings
  - Updates platform settings.
  - Requires admin authentication.
  - Request body is validated.

### Public (no auth)
- GET /api/platform/settings
  - Returns current platform settings for public consumers (like checkout apps).
  - Important: checkout/user app calls this backend endpoint, not Supabase directly.

## 2.1) Who connects to Supabase

- Direct Supabase access happens from backend service code only.
- User app and admin frontend call backend REST APIs.
- Backend then reads/writes platform_settings in Supabase.

So the flow is:
- Frontend/User App -> Backend API -> Supabase

## 3) Validation before storing

Incoming PUT /api/admin/settings payload is validated with Joi.

Rules:
- min_order_amount: number, min 0, optional
- delivery_fee: number, min 0, optional
- convenience_fee: number, min 0, optional
- free_delivery_above: number, min 0, optional
- At least one field must be present (.min(1))

If validation fails, API returns 422.

## 4) How data is stored in Supabase

Storage table:
- platform_settings

Current implementation uses a single-row pattern:
- Service checks if a row exists (limit 1).
- If row exists: update that row.
- If row does not exist: insert a new row.

So this behaves like one global config record for the platform.

## 5) Update flow (PUT /api/admin/settings)

1. Admin sends payload from UI.
2. Joi validates the request body.
3. Service builds an update object:
   - Keeps only allowed fields.
   - Converts values to Number.
   - Sets updated_at to current timestamp.
4. Service checks if platform_settings already has a row.
5. If exists -> UPDATE by id.
6. If missing -> INSERT.
7. Updated row is returned in API response.

## 6) Read flow

### Admin read flow
- GET /api/admin/settings calls the same service function and returns one row (or empty object if missing).

### Public read flow
- GET /api/platform/settings also calls the same service function.
- This is why admin changes become visible immediately to public consumers that read this endpoint.

## 7) Frontend handling

Admin page fetches and updates settings through:
- getSettings() -> GET /api/admin/settings
- updateSettings(payload) -> PUT /api/admin/settings

After successful save:
- UI replaces local form state with response data.
- Success message is shown.

## 8) Important behavior notes

- There is no settings history/audit trail in current code. Each save overwrites the single config row.
- Because public endpoint reads the same table, changes affect downstream fee calculation immediately.
- If table is empty, GET returns {} until first update inserts a row.

## 9) Quick DB checks in Supabase SQL editor

Use these to verify what is stored:

SELECT *
FROM platform_settings
ORDER BY updated_at DESC;

To inspect row count (single-row expectation):

SELECT COUNT(*) AS row_count
FROM platform_settings;

If row_count is greater than 1, service still uses the first row returned by limit(1), so you should clean extra rows and keep one canonical row.
