# 🔧 Notification Bell - Debugging Guide

## Current Issue
✅ **Incoming Order Popup**: Working (appears correctly)
❌ **Notification Bell**: Not showing notifications in dropdown

## Quick Diagnostic Steps

### Step 1: Check Browser Console (Press F12)
Open the browser **Console** tab and look for logs starting with:
```
[NotificationContext]
[NotificationBell]
[FCM]
```

**Expected logs on app load:**
```
[NotificationContext] 🚀 Effect running, courier: <some-id>
[NotificationContext] 📋 Calling fetchNotifications on mount...
[NotificationContext] Fetching notifications from DB...
[NotificationContext] ✅ Notifications fetched: [...]
[NotificationContext] ✅ Unread count: X
[NotificationBell] Rendering with: { unreadCount: X, notificationsCount: Y, isOpen: false }
```

**If you see errors:**
```
[NotificationContext] ❌ Error fetching history: <error message>
```

Write down the error message - this tells us what's wrong.

### Step 2: Click the Bell Icon
Click the notification bell in the top right. The dropdown should open.

**In Console, you should see:**
```
[NotificationBell] Rendering with: { unreadCount: 0, notificationsCount: 0, isOpen: true }
```

### Step 3: Click the Refresh Button (New!)
There's now a **refresh button** in the notification dropdown (looks like a circular arrow). Click it.

**In Console, you should see:**
```
[NotificationBell] 🔄 Manual refresh triggered by user
[NotificationContext] Fetching notifications from DB...
[NotificationContext] ✅ Notifications fetched: [...]
[NotificationBell] ✅ Manual refresh complete
```

### Step 4: Assign an Order
Go to the Seller/Admin panel and assign an order. At the same time:
1. Keep the browser **Console open**
2. Keep the **delivery app open** (or at least visible)

**You should see in Console:**
```
[NotificationContext] 📦 NEW_ASSIGNMENT detected, fetching assigned orders...
[NotificationContext] Setting incoming order: {...}
[NotificationContext] ⏱️ Auto-refreshing notifications from DB (500ms after FCM)...
[NotificationContext] Fetching notifications from DB...
[NotificationContext] ✅ Notifications fetched: [array with 1+ items]
```

---

## Troubleshooting Based on What You See

### Case 1: See `[NotificationContext] ❌ Error fetching history: 401`
**Problem:** Not authenticated
**Solution:** 
1. Logout from delivery app
2. Login again
3. Verify token is valid

### Case 2: See `[NotificationContext] ❌ Error fetching history: 404`
**Problem:** API endpoint not found
**Solution:**
1. Check backend routes are deployed
2. Verify `/api/delivery/notifications` endpoint exists
3. Check server logs for errors

### Case 3: See `[NotificationContext] ✅ Notifications fetched: []`
**Problem:** Notifications table is empty
**Solution:**
1. Assign a new order in admin panel
2. Check Supabase: is notification being created?
   ```sql
   SELECT * FROM delivery_notifications 
   WHERE delivery_partner_id = '<partner-id>'
   ORDER BY created_at DESC LIMIT 5;
   ```
3. If nothing in table, check backend logs

### Case 4: See `[NotificationContext] ✅ Notifications fetched: [{...}]` but bell still shows "No notifications yet"
**Problem:** Notifications fetched but not displaying
**Solution:**
1. Click bell to open dropdown
2. Click the refresh button (new!)
3. Check console for errors
4. If still not showing, check:
   - Is `unreadCount` > 0?
   - Check `notifications` array structure

### Case 5: See logs but nothing changes in UI
**Problem:** State update not triggering re-render
**Solution:**
1. Try refreshing page (F5)
2. Check browser console for React errors
3. Check if JavaScript is enabled
4. Try a different browser

---

## What Notifications Should Look Like

When working correctly, notifications show:
```
[Your Notification Bell Icon] "1"
                    ↓
         Clicking bell opens dropdown:
┌─────────────────────────────────┐
│ Notifications       1    🔄 ✓ ✓  │  <- 🔄 is refresh button (new!)
├─────────────────────────────────┤
│ 📦 New Delivery Assigned         │
│ Order #abc123 from Shop Name     │
│ 2 seconds ago                    │
│                              [X] │  <- Mark as read
├─────────────────────────────────┤
│ 📦 New Delivery Assigned         │
│ Order #def456 from Another Shop  │
│ 5 minutes ago                    │
│                              [X] │
└─────────────────────────────────┘
```

---

## Quick Fix Checklist

If notifications aren't showing:

1. **Backend Check**
   - [ ] Is notification being created in DB?
     ```sql
     SELECT COUNT(*) FROM delivery_notifications;
     ```
   - [ ] Check server logs for errors
   - [ ] Verify `/api/delivery/notifications` returns data

2. **Frontend Check**
   - [ ] Clear browser cache (Ctrl+Shift+Delete)
   - [ ] Close and reopen browser
   - [ ] Check console for errors
   - [ ] Check if useNotifications hook works

3. **API Check**
   - [ ] Try calling API directly:
     ```bash
     curl -H "Authorization: Bearer <token>" \
       http://localhost:5173/api/delivery/notifications
     ```
   - [ ] Should return: `{ success: true, data: [...] }`

4. **Database Check**
   - [ ] Verify `delivery_notifications` table exists
   - [ ] Verify `is_read` column exists
   - [ ] Insert test notification:
     ```sql
     INSERT INTO delivery_notifications 
     (delivery_partner_id, title, body, is_read, data)
     VALUES ('<partner-id>', 'Test', 'Test', false, '{}');
     ```
   - [ ] Check if it appears in bell

---

## New Features Added

✨ **Manual Refresh Button**
- Click the refresh icon (🔄) in the notification dropdown
- Forces a fresh fetch from database
- Useful for debugging or if auto-refresh doesn't work

📝 **Enhanced Logging**
- All notification operations now log to console
- Look for `[NotificationContext]`, `[NotificationBell]`, `[FCM]` prefixes
- Logs show exactly what's happening and errors

---

## Testing the Fix

### Test 1: Load App
1. Open delivery app
2. Check console for `[NotificationContext] 🚀 Effect running`
3. Check for `Notifications fetched`

### Test 2: Assign Order
1. Keep delivery app open with Console visible
2. Go to admin/seller panel
3. Assign order to delivery partner
4. Check console for:
   - `NEW_ASSIGNMENT detected`
   - `Auto-refreshing notifications from DB`
   - `Notifications fetched`
5. Bell should show "1" badge
6. Click bell: should show notification

### Test 3: Refresh Page
1. Assign an order
2. See notification appear in bell
3. Refresh page (F5)
4. Notification should still be there (from DB)

### Test 4: Manual Refresh
1. Click bell to open
2. Click refresh button (🔄)
3. Should re-fetch and show notifications

---

## Getting Help

When reporting an issue, include:
1. **Console logs** (copy-paste everything)
2. **Error message** (if any)
3. **What step fails** (Step 1-4 above)
4. **Browser/OS** (Firefox on Windows, Safari on Mac, etc.)
5. **Database check** (did the notification get created in DB?)

---

## Next: If Still Not Working

If notifications still don't appear after trying above:

1. **Check if assignment works:**
   - Does incoming card popup appear? (Yes = assignment works)
   - So backend assignment is fine ✅

2. **Check if API works:**
   - Open Network tab (F12 → Network)
   - Assign order
   - Look for request to `/api/delivery/notifications`
   - What status code? 200 = API works, 4XX = error

3. **Check if DB works:**
   - Supabase → delivery_notifications table
   - Assign order
   - Do you see new row in table?
   - Yes = DB works, might be fetch issue
   - No = Backend issue

4. **Check if hook works:**
   - Add this to browser console:
   ```javascript
   fetch('/api/delivery/notifications', {
     headers: { 'Authorization': 'Bearer ' + localStorage.getItem('bz_delivery_token') }
   }).then(r => r.json()).then(d => console.log(d))
   ```
   - What do you see?

---

This should help identify exactly where the issue is! 🎯
