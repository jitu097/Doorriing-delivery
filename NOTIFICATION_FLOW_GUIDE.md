# 🔍 Complete Notification Flow - Step-by-Step Debugging

## When Someone Assigns an Order - What Should Happen

```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN/SELLER PANEL: Click "Assign" Button                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: POST /api/admin/assignments                        │
│   {                                                         │
│     "order_id": "order-123",                               │
│     "delivery_partner_id": "partner-456"                   │
│   }                                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ adminService.assignDeliveryPartner()                        │
│                                                             │
│ [assignDeliveryPartner] 📢 Starting notification process... │
│ [assignDeliveryPartner] ✅ Assignment created: abc123...    │
│                                                             │
│ Fetches order details:                                      │
│   ├─ shop_name: "Jitendra Kirana Store"                    │
│   ├─ delivery_address: "Banpur, Latehar"                   │
│   └─ order_amount: "₹134.95"                               │
│                                                             │
│ [assignDeliveryPartner] 📦 Order details: shop=..., ...    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ sendPushNotification() called                               │
│                                                             │
│ [assignDeliveryPartner] 🚀 Calling sendPushNotification...  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ deliveryNotificationService.sendPushNotification()          │
│                                                             │
│ Step 1: Save to Database (CRITICAL)                        │
│ ────────────────────────────────                           │
│ INSERT INTO delivery_notifications:                        │
│   ├─ delivery_partner_id: "partner-456"                    │
│   ├─ title: "New Delivery Assigned"                        │
│   ├─ body: "Order #order-123 from Jitendra..."            │
│   ├─ is_read: false                                        │
│   └─ data: { order_id, shop_name, address, amount }       │
│                                                             │
│ [deliveryNotification] ✅ Notification saved to DB          │
│ [deliveryNotification] ✅ ID: notif-789                    │
│                                                             │
│ Step 2: Send FCM Push (Optional)                           │
│ ────────────────────────────────                           │
│ Fetch FCM tokens for delivery partner                      │
│ [deliveryNotification] Found X FCM tokens                  │
│ Send multicast message to all tokens                       │
│ [deliveryNotification] FCM sent. Success: X, Failure: Y    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ RESPONSE SENT TO ADMIN PANEL                                │
│ { success: true, data: { assignment_id: "abc123" } }        │
│                                                             │
│ [assignDeliveryPartner] ✅ Complete: Assignment created...  │
└──────────────────────────────────────────────────────────────┘

                         │
        ┌────────────────┴───────────────────┐
        │                                    │
        ▼                                    ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│ DELIVERY APP FOREGROUND  │        │ DATABASE                 │
│ (If open)                │        │ (Persistent)             │
│                          │        │                          │
│ FCM Push received        │        │ delivery_notifications   │
│ [NotificationContext]    │        │ table has new row:       │
│ 🔔 Foreground message    │        │                          │
│ received                 │        │ id: notif-789            │
│ Auto-refresh from DB     │        │ delivery_partner_id: ..  │
│ [NotificationContext]    │        │ title: "New Delivery..." │
│ ✅ Notifications        │        │ is_read: false           │
│ fetched: [notif-789]     │        │ created_at: 2026-04-29   │
│                          │        │                          │
│ [NotificationBell]       │        │ Unread Count:            │
│ Rendering with:          │        │ SELECT COUNT(*) WHERE    │
│  unreadCount: 1          │        │ is_read = false          │
│  notificationsCount: 1   │        │ → 1                      │
│                          │        │                          │
│ Bell Badge shows "1" ✅  │        └──────────────────────────┘
│ Dropdown shows notif ✅  │
└──────────────────────────┘
```

---

## Where to Check Logs

### 1️⃣ BACKEND LOGS (Server Console)
When you assign an order, look for these logs in your backend server:

```
[assignDeliveryPartner] 📢 Starting notification process...
[assignDeliveryPartner] ✅ Assignment created: <assignment-id>
[assignDeliveryPartner] 📦 Order details: shop=..., address=..., amount=...
[assignDeliveryPartner] 🚀 Calling sendPushNotification...
[deliveryNotification] ✅ Notification saved to DB for partner <id>, ID: <notif-id>
[deliveryNotification] Found X FCM tokens for partner <id>
[deliveryNotification] FCM sent. Success: X, Failure: Y
[assignDeliveryPartner] ✅ Complete: Assignment <id> created and notification sent
```

**If you DON'T see these logs:**
- Assignment might not be happening
- Check order ID and partner ID are valid

**If you see error:**
```
[assignDeliveryPartner] ❌ Notification hook failed: <error>
[deliveryNotification] CRITICAL - Error saving notification to DB: <error>
```
- Note the exact error message
- This tells us what went wrong

---

### 2️⃣ BROWSER CONSOLE (F12 on Delivery App)
When notification is received (if delivery app is open), look for:

```
[NotificationContext] 🚀 Effect running, courier: <partner-id>
[NotificationContext] 📋 Calling fetchNotifications on mount...
[NotificationContext] Fetching notifications from DB...
[NotificationContext] ✅ Notifications fetched: [...]
[NotificationContext] 🔔 Foreground FCM message received: {...}
[NotificationContext] ✅ Notifications fetched: [...] (after auto-refresh)
[NotificationBell] Rendering with: { unreadCount: 1, notificationsCount: 1 }
```

**If you DON'T see fetch logs:**
- NotificationContext might not be loading
- Check if useAuth() is returning courier data

**If you see error:**
```
[NotificationContext] ❌ Error fetching history: <error>
```
- Check internet connection
- Check API endpoint is reachable
- Check authentication token is valid

---

### 3️⃣ DATABASE (Supabase)
Go to Supabase → SQL Editor and run:

```sql
-- Check if notification was created
SELECT * FROM delivery_notifications 
WHERE delivery_partner_id = '<partner-id>'
ORDER BY created_at DESC LIMIT 1;

-- Expected columns:
-- id: <uuid>
-- delivery_partner_id: <uuid>
-- title: "New Delivery Assigned"
-- body: "Order #... from ..."
-- is_read: false
-- data: { order_id, shop_name, ... }
-- created_at: 2026-04-29 12:34:56

-- Check unread count
SELECT COUNT(*) as unread_count FROM delivery_notifications 
WHERE delivery_partner_id = '<partner-id>' AND is_read = false;
-- Expected: 1 (or more if multiple notifications)
```

**If query returns 0 rows:**
- Notification was NOT created
- Backend error (check server logs)

**If query returns 1+ rows but bell doesn't show:**
- Database is fine ✅
- Frontend fetch issue (check browser console)

---

## Complete Testing Checklist

### Pre-Check
- [ ] Backend server is running
- [ ] Frontend app is running
- [ ] Delivery partner is logged in
- [ ] Browser console is open (F12)
- [ ] Server logs are visible

### Assign Order
- [ ] Go to Admin/Seller panel
- [ ] Click "Assign" to delivery partner
- [ ] **Watch server logs** for notification logs

### Check at Each Step

#### Step 1: Backend (Server Logs)
```
✅ Should see: [assignDeliveryPartner] ✅ Assignment created
✅ Should see: [deliveryNotification] ✅ Notification saved to DB
❌ If NOT: Backend issue - check error message in logs
```

#### Step 2: Database (Supabase)
```sql
SELECT * FROM delivery_notifications 
WHERE delivery_partner_id = '<partner-id>'
ORDER BY created_at DESC LIMIT 1;
```
```
✅ Should see: 1 new row with is_read = false
❌ If NOT: DB save failed - check server error logs
```

#### Step 3: API (Browser Network Tab)
1. Open F12 → Network tab
2. Assign order
3. Look for request: `POST /api/admin/assignments`
```
✅ Status should be: 200 (OK)
✅ Response should have: { success: true, data: {...} }
❌ If Status 4XX/5XX: API error - check backend
```

#### Step 4: Frontend Fetch (Browser Console)
1. Keep console open
2. Click bell icon
3. Watch for:
```
[NotificationContext] Fetching notifications from DB...
[NotificationContext] ✅ Notifications fetched: [...]
[NotificationBell] Rendering with: { unreadCount: 1 }
```
```
✅ Should see notifications array with 1+ items
❌ If empty array: API returning no data - check Supabase
```

#### Step 5: UI (Visual Check)
```
✅ Bell should show "1" badge
✅ Click bell → dropdown shows notification
❌ If "No notifications yet": Frontend issue
```

---

## Quick Diagnostic Command

Run this in **browser console** when delivery app is open:

```javascript
// Test 1: Check if context exists
console.log('useNotifications available:', typeof useNotifications);

// Test 2: Check API endpoint
fetch('/api/delivery/notifications', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('bz_delivery_token')
  }
})
.then(r => {
  console.log('API Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('API Response:', data);
  console.log('Notifications Count:', data.data?.length || 0);
})
.catch(e => console.error('API Error:', e.message));

// Test 3: Check database directly
// (Go to Supabase and run SQL query from Step 3 above)
```

---

## Most Common Issues & Solutions

### Issue 1: "No notifications yet" message
**Check Order:**
1. ✅ Backend: Are logs showing notification created?
   - YES → Go to Issue 2
   - NO → Backend error (read server logs)

2. ✅ Database: Does notification exist?
   - YES → Go to Issue 2
   - NO → Backend didn't save it (check server logs)

### Issue 2: Notification in DB but not showing in bell
**Check Order:**
1. ✅ Is getNotifications() API returning it?
   - Call manually: `fetch('/api/delivery/notifications'...)`
   - NO → API error or delivery partner ID wrong
   - YES → Go to next

2. ✅ Is React state updating?
   - Check browser console for fetch logs
   - Should see: `✅ Notifications fetched: [...]`
   - NO → React issue
   - YES → Check unreadCount

3. ✅ Is NotificationBell re-rendering?
   - Should see in console: `Rendering with: { unreadCount: 1 }`
   - NO → Component not updating
   - YES → UI issue (check CSS or HTML)

### Issue 3: FCM push not received but DB has notification
✅ **This is NORMAL and OK!**
- Notification is persisted in database ✅
- Delivery partner will see it when they open the app ✅
- FCM is optional enhancement, not critical ✅

---

## Next Steps

1. **Assign an order** and watch these 3 places:
   - Server logs
   - Supabase database
   - Browser console

2. **Note which step fails:**
   - No backend logs? → Backend issue
   - No DB entry? → Save failed
   - No API response? → API issue
   - API returns data but bell empty? → Frontend issue

3. **Share the error/logs** so we can fix the exact problem

Let me know what you find! 🔍
