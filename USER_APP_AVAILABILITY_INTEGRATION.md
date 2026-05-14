# User App — App Availability Integration Guide

## Why Orders Were Still Placing

The `checkAppAvailability` middleware in this backend only runs if the User App's order creation
goes through **this backend's API**. However, the User App creates orders **directly in Supabase**
using the Supabase JS client — bypassing the backend entirely.

**The fix is a PostgreSQL BEFORE INSERT trigger** (migration `005_order_availability_trigger.sql`)
that runs inside the database, making it impossible to bypass from any client.

---

## Step 1: Run the DB Trigger Migration (REQUIRED — This Fixes the Issue)

> [!IMPORTANT]
> This is the critical step that actually blocks orders at the DB level.

Open your **Supabase SQL Editor** and run the full contents of:

```
backend/migrations/005_order_availability_trigger.sql
```

This creates:
1. `check_app_availability_open()` — PostgreSQL function that reads your `app_availability` table
2. `trg_block_order_when_closed()` — trigger function that raises an error when closed
3. `trg_check_app_availability` — BEFORE INSERT trigger on the `orders` table

**After running this, test it:**

```sql
-- Turn app OFF
UPDATE app_availability SET is_app_enabled = false WHERE id = 1;

-- Try inserting an order (replace with real values) — it WILL FAIL
-- INSERT INTO orders (...) VALUES (...);

-- Turn app back ON  
UPDATE app_availability SET is_app_enabled = true WHERE id = 1;
```

---

## What the Trigger Error Looks Like

When the trigger blocks an order, Supabase returns this error to the client:

```json
{
  "code": "P0001",
  "message": "APP_UNAVAILABLE: We are currently not accepting orders. Please try again later.",
  "details": null,
  "hint": null
}
```

---

## Step 2: Handle the Trigger Error in Your User App

In your User App's order creation code, catch this error and show the right message:

```js
// orderService.js in User App
import { supabase } from '@/lib/supabase';

export const createOrder = async (orderPayload) => {
  const { data, error } = await supabase
    .from('orders')
    .insert(orderPayload)
    .select()
    .single();

  if (error) {
    // Check if this is an app availability block
    if (error.code === 'P0001' && error.message?.includes('APP_UNAVAILABLE')) {
      // Strip the "APP_UNAVAILABLE: " prefix for clean display
      const userMessage = error.message.replace('APP_UNAVAILABLE: ', '');
      throw new Error(userMessage);
    }
    // Other DB errors
    throw new Error(error.message || 'Failed to place order');
  }

  return data;
};
```

### In Your Checkout Component

```jsx
const handlePlaceOrder = async () => {
  // 1. Client-side check first (fast, from polling hook)
  if (!isOpen) {
    showToast(reason || 'Orders are not available right now');
    return;
  }

  try {
    await orderService.createOrder(payload);
    navigateToOrderSuccess();
  } catch (err) {
    // Handles BOTH client-side bypass AND trigger block
    showToast(err.message || 'Could not place order. Please try again.');
  }
};
```

---

## Step 3: Add the Polling Hook (Client-side UX)

The database trigger handles **security**. The polling hook handles **UX** — showing users the
unavailable screen before they even try to checkout.

Copy `frontend/src/hooks/useAppAvailability.js` to your User App and set your API base URL:

```js
// In useAppAvailability.js — update this line:
const API_BASE = 'https://doorriing-delivery-3.onrender.com/api';
```

### Use in Checkout Page

```jsx
import { useAppAvailability } from '@/hooks/useAppAvailability';

const CheckoutPage = () => {
  const { isOpen, isLoading, reason } = useAppAvailability();

  if (isLoading) return <Spinner />;

  if (!isOpen) {
    return (
      <div style={{
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px',
        gap: '16px'
      }}>
        <span style={{ fontSize: '4rem' }}>🔒</span>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          Service Temporarily Unavailable
        </h2>
        <p style={{ color: '#666', maxWidth: '380px', lineHeight: 1.6 }}>
          {reason || 'We are currently not accepting orders. Please try again later.'}
        </p>
      </div>
    );
  }

  return <CheckoutForm />;
};
```

---

## Public API Endpoint (for the hook)

```
GET https://doorriing-delivery-3.onrender.com/api/platform/availability
Authorization: none required
```

### Response when Open
```json
{
  "success": true,
  "data": {
    "is_app_enabled": true,
    "delivery_start_time": "09:00",
    "delivery_end_time": "23:00",
    "isCurrentlyOpen": true,
    "closedReason": null,
    "blockedBy": null
  }
}
```

### Response when Closed (toggle OFF)
```json
{
  "success": true,
  "data": {
    "is_app_enabled": false,
    "isCurrentlyOpen": false,
    "closedReason": "We are currently not accepting orders. Please try again later.",
    "blockedBy": "toggle"
  }
}
```

### Response when Outside Hours
```json
{
  "success": true,
  "data": {
    "isCurrentlyOpen": false,
    "closedReason": "Orders are available between 9:00 AM – 11:00 PM",
    "blockedBy": "time_window"
  }
}
```

---

## Architecture: Two-Layer Defense

```
USER APP
   │
   ├─ Layer 1 (UX): useAppAvailability hook polls every 30s
   │   → Shows unavailable screen before user even reaches checkout
   │   → Prevents order button from showing when closed
   │
   └─ Layer 2 (Security): PostgreSQL BEFORE INSERT trigger
       → Blocks INSERT into orders table at DB level
       → Cannot be bypassed by any client, API call, or script
       → Returns P0001 error code to Supabase client
```

---

## Safety Guarantees

| What | Protected? | How |
|---|---|---|
| Existing active orders | ✅ Unaffected | Trigger is BEFORE INSERT only — no effect on existing rows |
| Order status updates (PATCH/UPDATE) | ✅ Unaffected | Trigger is INSERT-only |
| Payment / Razorpay flow | ✅ Unaffected | No changes to payment tables |
| Delivery partner flow | ✅ Unaffected | Delivery routes untouched |
| Seller dashboard | ✅ Unaffected | Shop routes untouched |
| Admin login | ✅ Unaffected | Auth untouched |
| New order placement | ❌ Blocked when OFF or outside hours | DB trigger |
