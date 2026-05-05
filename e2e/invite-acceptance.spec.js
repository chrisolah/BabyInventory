// Co-parent invite, end-to-end.
//
// Flow under test:
//   User A signs up + onboards → opens InviteMemberModal from Profile →
//   sends an invite to User B's address → we read the freshly-created
//   beta.pending_invites token via service role → User A signs out →
//   User B signs up via the /invite/:token preview link → User B is
//   added to User A's household.
//
// Why this matters pre-launch: shared-data flows are where RLS bugs hide.
// If accept_invite ever stops adding the new member to the household
// correctly, families silently fail to share inventory and users blame
// the app for "losing" co-parent updates. The bug is invisible without
// this kind of test.

import { test, expect } from '@playwright/test'
import { admin } from './support/db.js'
import {
  freshEmail,
  signUpWithPassword,
  signOutFromProfile,
  blastThroughOnboardingToHome,
} from './support/helpers.js'

test('invite flow: A invites B → B signs up + accepts → both share a household', async ({ page }) => {
  const aEmail = freshEmail()
  const bEmail = freshEmail()
  const householdName = 'Invite E2E Household'

  // ── User A: sign up + onboard + send invite ────────────────────────────
  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Inviter A', email: aEmail })
  await blastThroughOnboardingToHome(page, { householdName, babyName: 'Invite Baby' })

  // Open InviteMemberModal from /profile → Household tab. The "Invite
  // someone" CTA is on the Household tab specifically; tab=household
  // pre-selects it without us hunting for the toggle.
  await page.goto('/profile?tab=household')
  await page.getByRole('button', { name: /invite|invite a household member|invite someone/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByPlaceholder('partner@example.com').fill(bEmail)
  await page.getByRole('button', { name: /send invite/i }).click()
  // The success state replaces the form with "Invite sent to …"
  await expect(page.getByText(/invite sent to/i)).toBeVisible()
  await page.getByRole('button', { name: /^done$/i }).click()

  // ── Read the invite token via service role ─────────────────────────────
  // peek_invite/accept_invite use the row's UUID id as the token. Find
  // the freshest active invite for B's email — there's only one because
  // globalSetup wiped beforehand.
  const { data: invites, error: inviteErr } = await admin
    .from('pending_invites')
    .select('id, household_id, invited_email, accepted_at, revoked_at, expires_at')
    .eq('invited_email', bEmail)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  expect(inviteErr).toBeNull()
  expect(invites?.length, 'expected one pending invite for B').toBe(1)
  const inviteToken = invites[0].id
  const householdId = invites[0].household_id

  await signOutFromProfile(page)

  // ── User B: open the invite link → Sign up → land back on /invite ──────
  await page.goto(`/invite/${inviteToken}`)
  await expect(page.getByRole('heading', { name: /you're invited/i })).toBeVisible()
  // Email appears twice on the AcceptInvite preview — once in the metadata
  // card (.cardValue span) and once in the bottom hint as <strong>. Either
  // confirms the invite renders for the right address; .first() picks the
  // metadata-card occurrence and avoids the strict-mode violation.
  await expect(page.getByText(bEmail).first()).toBeVisible()

  await page.getByRole('button', { name: /create my account/i }).click()
  await expect(page).toHaveURL(/\/signup\?/)

  // Email is pre-filled by the redirect (?email=...). Confirm + fill the
  // remaining fields.
  await expect(page.getByPlaceholder('sarah@example.com')).toHaveValue(bEmail)
  await signUpWithPassword(page, { name: 'Invitee B', email: bEmail })

  // After signup with ?next=/invite/:token, the AuthProvider sees a session
  // and bounces back to the invite preview. The Accept button is now visible
  // because email matches.
  await expect(page).toHaveURL(new RegExp(`/invite/${inviteToken}`))
  await page.getByRole('button', { name: /^join /i }).click()

  // Brief success splash, then /home.
  await expect(page).toHaveURL(/\/home/, { timeout: 5000 })

  // ── Assert via service role: B is now in A's household ────────────────
  const { data: bUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
  const b = bUsers.users.find(u => u.email?.toLowerCase() === bEmail.toLowerCase())
  expect(b, 'expected to find user B').toBeTruthy()

  const { data: members, error: memErr } = await admin
    .from('household_members')
    .select('user_id, role, household_id')
    .eq('household_id', householdId)
  expect(memErr).toBeNull()
  expect(members?.length, 'household should have 2 members after accept').toBe(2)
  const bMembership = members.find(m => m.user_id === b.id)
  expect(bMembership, 'B must be a member of the household').toBeTruthy()
  expect(bMembership.role).toBe('member')

  // The pending_invites row was redeemed.
  const { data: redeemed } = await admin
    .from('pending_invites')
    .select('accepted_at')
    .eq('id', inviteToken)
    .maybeSingle()
  expect(redeemed?.accepted_at, 'pending_invites.accepted_at must be set').toBeTruthy()
})
