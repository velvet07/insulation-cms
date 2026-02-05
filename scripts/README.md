# Database Scripts

## Create Admin User

**File:** `create-admin-user.sql`

**Usage on VPS:**

```bash
# SSH to server
ssh root@cms.emermedia.eu

# Navigate to project
cd /home/deploy/insulation-cms

# Run SQL script (replace with your actual DB credentials)
psql -U postgres -d insulation_cms -f /path/to/create-admin-user.sql

# Or if using environment variables:
psql $DATABASE_URL -f /path/to/create-admin-user.sql
```

**Default credentials:**
- Username: `admin`
- Password: `Admin123!`

**⚠️ CHANGE PASSWORD IMMEDIATELY AFTER FIRST LOGIN**
