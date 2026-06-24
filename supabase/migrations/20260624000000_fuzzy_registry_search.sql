-- Upgrade registry search to pg_trgm trigram similarity for typo tolerance.
-- Gift-givers can now find "Johnson family" by typing "Jonson" or "Johnsen".
-- word_similarity() is used (vs plain similarity()) because queries are often
-- a single name token that should match against multi-word household/member names.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on household names so similarity lookups stay fast.
CREATE INDEX IF NOT EXISTS households_name_trgm_idx
  ON beta.households USING gin (name gin_trgm_ops);

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
    AND (u.is_anonymous IS NOT TRUE)
  LEFT JOIN beta.babies b ON b.household_id = h.id
  WHERE (
    _query = ''
    OR h.name ILIKE '%' || _query || '%'
    OR word_similarity(_query, h.name) > 0.35
    OR EXISTS (
      SELECT 1
      FROM beta.household_members hm2
      JOIN auth.users u2 ON u2.id = hm2.user_id
      WHERE hm2.household_id = h.id
        AND (
          (u2.raw_user_meta_data->>'name') ILIKE '%' || _query || '%'
          OR word_similarity(_query, coalesce(u2.raw_user_meta_data->>'name', '')) > 0.35
        )
    )
  )
  GROUP BY h.id, h.name, ws.token
  ORDER BY
    CASE WHEN _query = '' THEN 0
         ELSE GREATEST(word_similarity(_query, h.name), 0)
    END DESC,
    h.name
  LIMIT 20
$$;

GRANT EXECUTE ON FUNCTION beta.search_registries(text) TO anon, authenticated;
