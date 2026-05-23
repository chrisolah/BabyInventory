import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

// Status bar text-colour control.
//
// Capacitor's Style names describe the *background* the bar sits on, which
// reads backwards at first:
//   Style.Dark  -> light (white) text, for dark backgrounds  -> the teal splash
//   Style.Light -> dark text, for light backgrounds          -> the app
//
// Every call is native-gated and swallows errors, so this module is safe to
// import from shared components — on the web it simply does nothing.

export function setStatusBarForSplash() {
  if (!Capacitor.isNativePlatform()) return
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
}

export function setStatusBarForApp() {
  if (!Capacitor.isNativePlatform()) return
  StatusBar.setStyle({ style: Style.Light }).catch(() => {})
}
