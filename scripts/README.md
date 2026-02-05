# Database Scripts

## 1. User-ek és jelszó ellenőrzése

**Fájl:** `check-users.sql`

Kilistázza az összes usert és azt, hogy van-e jelszó hash (VAN / NINCS).

```bash
# VPS-en (PostgreSQL)
cd /home/deploy/insulation-cms
psql $DATABASE_URL -f scripts/check-users.sql
```

Ha valakinél NINCS jelszó, azt az admin felületen vagy a `create-admin-user.sql`-lel lehet beállítani.

---

## 2. Jelszó mező az admin felületen – ez így helyes

- **Üres mező újranyitáskor:** Normális. A Strapi soha nem jeleníti meg a tárolt jelszót (biztonság).
- **Új jelszó megadása:** Beírod, Save → a rendszer titkosítva elmenti. Utána a mező ismét üres lesz – ez nem hiba.

**Ismert Strapi hiba:** Ha a jelszó mezőt **üresen hagyod** és csak más mezőt (pl. email) módosítasz, a mentés néha **null**-t küld a jelszónak, és **törli a jelszót** az adatbázisban.  
→ Ha jelszót változtatsz: **mindig írj be újat**, ne hagyd üresen.  
→ Ha csak más mezőt változtatsz: a jelszó mező üresen hagyása kockázatos; ilyenkor biztonságosabb a `check-users.sql` + szükség esetén `create-admin-user.sql` (jelszó reset).

---

## 3. Create Admin User

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
