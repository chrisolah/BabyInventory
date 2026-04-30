import { Outlet } from 'react-router-dom'
import IvyDecoration from './IvyDecoration'

// Layout wrapper for the marketing/SEO pages (Landing + HowItWorks).
// Mounting IvyDecoration here (instead of inside each page) keeps the
// component instance alive when React Router swaps the Outlet content
// between routes. Without this layout, the 9-second stem-grow + leaf-
// unfurl animation restarted every time the user clicked "How it works"
// from the landing nav.
//
// IvyBanner is intentionally NOT rendered here. It lives between each
// page's nav and hero in the visual hierarchy, and each page owns its
// own nav. Moving IvyBanner to the layout would render it above both
// navs, which is wrong. Mobile IvyBanner therefore still remounts per
// page; the desktop ivy that Chris noticed regrowing is what this fixes.
//
// Other public routes (Signup, Login, ResetPassword, AcceptInvite) are
// intentionally left outside this layout — they don't currently render
// ivy and shouldn't suddenly start.
export default function LandingLayout() {
  return (
    <>
      <IvyDecoration />
      <Outlet />
    </>
  )
}
