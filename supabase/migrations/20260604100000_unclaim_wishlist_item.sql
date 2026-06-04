-- Adds unclaim_wishlist_item RPC for the immediate-undo flow on the
-- public wishlist page. Callable by anon so no auth is required.

CREATE OR REPLACE FUNCTION beta.unclaim_wishlist_item(
  p_token        text,
  p_slot_id      text,
  p_slot_type    text,
  p_size_label   text,
  p_claimer_name text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = beta, public
AS $$
DECLARE
  v_share_id uuid;
BEGIN
  SELECT id INTO v_share_id
  FROM beta.wishlist_shares
  WHERE token = p_token AND is_active = true;

  IF v_share_id IS NULL THEN
    RETURN jsonb_build_object('error', 'share_not_found');
  END IF;

  DELETE FROM beta.wishlist_claims
  WHERE share_id     = v_share_id
    AND slot_id      = p_slot_id
    AND slot_type    = p_slot_type
    AND (size_label  = p_size_label OR (size_label IS NULL AND p_size_label IS NULL))
    AND claimer_name = p_claimer_name;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION beta.unclaim_wishlist_item FROM PUBLIC;
GRANT EXECUTE ON FUNCTION beta.unclaim_wishlist_item TO anon, authenticated;
