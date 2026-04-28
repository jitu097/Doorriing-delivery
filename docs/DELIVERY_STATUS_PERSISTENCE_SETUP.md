# Delivery Partner Online/Offline Status Persistence Setup

## Overview

This document explains the implementation of persistent Online/Offline status for delivery partners. The status now:
- Is saved to the database
- Persists across page refreshes and logins
- Filters delivery partners from the seller panel when offline
- Prevents new order assignments to offline partners

## Database Migration

### Required Column Addition

The `delivery_partners` table needs a new column for storing the delivery status:

```sql
ALTER TABLE delivery_partners
ADD COLUMN delivery_status VARCHAR(20) DEFAULT 'online' NOT NULL
CHECK (delivery_status IN ('online', 'offline'));
```

**Steps in Supabase Dashboard:**

1. Go to SQL Editor
2. Run the above SQL query
3. Verify the column appears in the `delivery_partners` table schema

**Default Behavior:**
- All existing delivery partners default to `online`
- New delivery partners are created with `online` status

## Backend Changes

### New API Endpoints

#### 1. GET `/api/delivery/profile`
**Purpose:** Fetch current delivery partner profile including their online/offline status

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Rider Name",
    "email": "rider@example.com",
    "phone": "+1234567890",
    "vehicle_type": "bike",
    "is_active": true,
    "delivery_status": "online"
  }
}
```

#### 2. PATCH `/api/delivery/status`
**Purpose:** Update the delivery partner's online/offline status

**Request Body:**
```json
{
  "delivery_status": "online" | "offline"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Delivery status updated",
  "data": {
    "id": "uuid",
    "name": "Rider Name",
    "delivery_status": "offline"
  }
}
```

### Modified API Endpoints

#### GET `/api/delivery/login`
**Change:** Now returns `delivery_status` in partner data

```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "partner": {
      "id": "uuid",
      "name": "Rider Name",
      "email": "rider@example.com",
      "vehicle_type": "bike",
      "delivery_status": "online"
    }
  }
}
```

#### GET `/api/admin/delivery-partners`
**Change:** Now filters to show ONLY online partners with `is_active = true`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Rider Name",
      "email": "rider@example.com",
      "phone": "+1234567890",
      "vehicle_type": "bike",
      "is_active": true,
      "delivery_status": "online",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

## Frontend Changes

### Updated Components

#### DeliveryDashboard
- **On Mount:** Fetches actual delivery status from `GET /api/delivery/profile`
- **On Toggle:** Updates database first via `PATCH /api/delivery/status`, then updates UI
- **Status Default:** No longer defaults to `online` - uses DB value
- **Persistence:** Status is loaded from database on every page load/refresh

#### DeliveryStatusButtons
- **New Prop:** `isUpdating` - shows loading state while updating
- **Disabled State:** Button is disabled while update is in progress
- **Visual Feedback:** Button text changes to "..." during update

### New Service Methods

```javascript
// Fetch current delivery partner profile with status
deliveryService.getProfile()
  .then(profile => {
    const status = profile.delivery_status; // 'online' or 'offline'
  })

// Update delivery status
deliveryService.updateDeliveryStatus('offline')
  .then(result => {
    console.log('Status updated to:', result.delivery_status);
  })
```

## Safety Guarantees

### Active Order Protection
- If a delivery partner goes offline while handling active orders:
  - Existing assigned orders remain in their active state
  - Orders can still be updated (accepted, picked up, delivered)
  - No new orders will be assigned to offline partners

### Session Safety
- Offline status is persistent in database
- Going offline doesn't log out the delivery partner
- They can still complete active orders
- They must go back online to receive new assignments

### Seller Panel Safety
- Only online delivery partners are visible in seller's delivery selection
- Offline partners cannot be assigned new orders
- If a partner goes offline mid-shift, they're immediately hidden from new assignments

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Delivery partner can toggle online/offline
- [ ] Status persists after page refresh
- [ ] Status persists after login/logout
- [ ] Offline partners don't appear in seller panel
- [ ] Offline partners can still complete active orders
- [ ] Admin can create new delivery partners (they start online)
- [ ] No errors in browser console
- [ ] No errors in server logs

## Rollback Instructions

If needed to rollback:

```sql
-- Option 1: Remove the column entirely
ALTER TABLE delivery_partners DROP COLUMN delivery_status;

-- Option 2: Set all partners back to online
UPDATE delivery_partners SET delivery_status = 'online';
```

## Migration Timeline

1. **Deploy Backend Changes** - New API endpoints available but not required
2. **Run Database Migration** - Add `delivery_status` column with default 'online'
3. **Deploy Frontend Changes** - New UI uses new endpoints
4. **Verify** - Test status persistence with a delivery partner account

## Known Limitations

- Status changes are immediate (no grace period)
- Offline status is simple binary (no "busy" or "on-break" states)
- No automatic timeout (partner must manually toggle to online)
- Historical status changes are not logged

## Future Enhancements

- Add status change history/audit log
- Add automatic timeout after inactivity
- Add "break" status for longer breaks
- Add admin ability to force online/offline a partner
- Add notifications for partners when they receive assignments
