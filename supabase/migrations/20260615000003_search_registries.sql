-- Public registry search RPC.
-- Callable by anon + authenticated roles so gift-givers can find registries
-- without an account. Returns only households that have at least one active
-- wishlist_shares row (i.e. the parent intentionally shared their registry).
-- Search matches household name OR any member's display name (case-insensitive).
-- Empty query string returns all active-share households (paginated to 20).

CREATE OR REPLACE FUNCTION beta.search_registries(_query text)
RETURNS TABLE (
  household_id   uuid,
  household_name text,
  member_names   text[],
  baby_names     text[],
  registry_token text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = beta, public
AS $$
  WITH active_shares AS (
    -- One row per household; pick the most recently created active share token
    SELECT DISTINCT ON (household_id)
      household_id,
      token
    FROM beta.wishlist_shares
    WHERE is_active = true
    ORDER BY household_id, created_at DESC
  )
  SELECT
    h.id::uuid                                                            AS household_id,
    h.name::text                                                          AS household_name,
    array_remove(
      array_agg(DISTINCT coalesce(
        nullif(u.raw_user_meta_data->>'name', ''),
        u.email::text
      )),
      NULL
    )::text[]                                                             AS member_names,
    array_remove(array_agg(DISTINCT b.name), NULL)::text[]               AS baby_names,
    ws.token::text                                                        AS registry_token
  FROM beta.households h
  JOIN active_shares ws ON ws.household_id = h.id
  LEFT JOIN beta.household_members hm ON hm.household_id = h.id
  LEFT JOIN auth.users u ON u.id = hm.user_id
    AND (u.is_anonymous IS NOT TRUE)   -- exclude trial/anon members from name list
  LEFT JOIN beta.babies b ON b.household_id = h.id
  WHERE (
    _query = ''
    OR h.name ILIKE '%' || _query || '%'
    OR EXISTS (
      SELECT 1
      FROM beta.household_members hm2
      JOIN auth.users u2 ON u2.id = hm2.user_id
      WHERE hm2.household_id = h.id
        AND (u2.raw_user_meta_data->>'name') ILIKE '%' || _query || '%'
    )
  )
  GROUP BY h.id, h.name, ws.token
  ORDER BY h.name
  LIMIT 20
$$;

-- Grant to both anon (gift-givers without an account) and authenticated users
GRANT EXECUTE ON FUNCTION beta.search_registries(text) TO anon, authenticated;
