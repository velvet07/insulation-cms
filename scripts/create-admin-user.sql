-- Create admin user with password: Admin123!
-- Password hash for "Admin123!" generated with bcrypt (10 rounds)

DO $$
DECLARE
  admin_role_id INTEGER;
  admin_user_id INTEGER;
BEGIN
  -- Get the Admin role ID
  SELECT id INTO admin_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;
  
  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Admin role not found';
  END IF;

  -- Check if admin user already exists
  SELECT id INTO admin_user_id FROM up_users WHERE username = 'admin';

  IF admin_user_id IS NULL THEN
    -- Create admin user
    INSERT INTO up_users (
      username,
      email,
      provider,
      password,
      confirmed,
      blocked,
      created_at,
      updated_at
    ) VALUES (
      'admin',
      'admin@insulation-cms.local',
      'local',
      '$2a$10$N9qo8uLOickgx2ZMRZoMye7L7fX7o6RKVB8J8T8yJj7JYsHKjUj2u', -- Admin123!
      true,
      false,
      NOW(),
      NOW()
    ) RETURNING id INTO admin_user_id;

    -- Link user to role
    INSERT INTO up_users_role_links (user_id, role_id)
    VALUES (admin_user_id, admin_role_id);

    RAISE NOTICE 'Admin user created successfully with ID: %', admin_user_id;
  ELSE
    -- Update existing admin user password
    UPDATE up_users 
    SET 
      password = '$2a$10$N9qo8uLOickgx2ZMRZoMye7L7fX7o6RKVB8J8T8yJj7JYsHKjUj2u',
      confirmed = true,
      blocked = false,
      updated_at = NOW()
    WHERE id = admin_user_id;

    RAISE NOTICE 'Admin user password updated for ID: %', admin_user_id;
  END IF;
END $$;

-- Verify admin user
SELECT 
  id,
  username,
  email,
  confirmed,
  blocked
FROM up_users 
WHERE username = 'admin';
