
-- Create a security definer function to handle family creation atomically
CREATE OR REPLACE FUNCTION public.create_family_with_owner(
  _family_name text,
  _user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _family_id uuid;
  _existing_family_id uuid;
BEGIN
  -- Check if user already has a family
  SELECT family_id INTO _existing_family_id
  FROM family_members
  WHERE user_id = _user_id
  LIMIT 1;

  IF _existing_family_id IS NOT NULL THEN
    RETURN _existing_family_id;
  END IF;

  -- Create the family
  INSERT INTO families (name)
  VALUES (_family_name)
  RETURNING id INTO _family_id;

  -- Add user as owner
  INSERT INTO family_members (family_id, user_id, role)
  VALUES (_family_id, _user_id, 'owner');

  RETURN _family_id;
END;
$$;
