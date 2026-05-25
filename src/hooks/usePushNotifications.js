// usePushNotifications — registers the device for APNs push notifications
// and saves the token to the DB via the save_push_token RPC.
//
// Only activates on native iOS (Capacitor). On web it's a no-op so the hook
// is safe to call unconditionally in ProtectedLayout.
//
// Call order:
//   1. Mount in ProtectedLayout (user is guaranteed to be authenticated).
//   2. Request permission on first mount.
//   3. On registration, call save_push_token RPC to persist the token.
//   4. Handle foreground push received (log; system handles background).
//
// Permissions: iOS requires the Push Notifications capability in the Xcode
// project and an APNs key in Apple Developer portal.

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'

let registered = false // module-level flag — avoid re-registering on re-mount

export function usePushNotifications() {
  useEffect(() => {
    // Only run on native iOS.
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return
    if (registered) return

    async function init() {
      // Dynamic import keeps the plugin out of the web bundle entirely.
      const { PushNotifications } = await import('@capacitor/push-notifications')

      // Check / request permission.
      let permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions()
      }
      if (permStatus.receive !== 'granted') {
        console.log('[push] permission not granted:', permStatus.receive)
        return
      }

      // Register with APNs. The OS gives us a token via the 'registration' event.
      await PushNotifications.register()

      // Save token to DB.
      PushNotifications.addListener('registration', async ({ value: token }) => {
        registered = true
        console.log('[push] registered, saving token')
        const { error } = await supabase.rpc('save_push_token', {
          _token: token,
          _platform: 'ios',
        })
        if (error) console.error('[push] save_push_token error:', error)
      })

      // Log registration failures (usually a simulator limitation).
      PushNotifications.addListener('registrationError', ({ error }) => {
        console.warn('[push] registration error:', error)
      })

      // Handle notifications received while the app is in the foreground.
      // Capacitor shows a heads-up banner automatically; we just log here.
      // To navigate to a specific screen on tap, handle pushNotificationActionPerformed.
      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('[push] received in foreground:', notification.title)
      })

      // Handle tap on a notification (foreground or background).
      PushNotifications.addListener('pushNotificationActionPerformed', action => {
        const data = action.notification.data ?? {}
        console.log('[push] tapped, screen:', data.screen)
        // Future: navigate to data.screen if provided.
      })
    }

    init().catch(err => console.error('[push] init error:', err))
  }, [])
}
