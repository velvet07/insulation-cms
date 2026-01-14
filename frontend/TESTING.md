# Testing Guide

## 🧪 Frontend Tesztelés

### 1. Development Szerver Indítása

```bash
cd frontend
npm run dev
```

A frontend elérhető: `http://localhost:3000`

### 2. API Kapcsolat Tesztelése

**Automatikus teszt:**
```bash
node test-frontend-api.js
```

**Manuális teszt:**
1. Nyisd meg: `http://localhost:3000`
2. Ellenőrizd, hogy az "API Status" zöld ✅-t mutat
3. Ellenőrizd a "Projects" számot

### 3. Environment Változók Ellenőrzése

```bash
cd frontend
cat .env.local
```

Kell tartalmaznia:
- `NEXT_PUBLIC_STRAPI_URL=https://cms.emermedia.eu`
- `NEXT_PUBLIC_STRAPI_API_TOKEN=...`

### 4. TypeScript Compile Teszt

```bash
cd frontend
npm run build
```

Ha nincs hiba, akkor a TypeScript típusok rendben vannak.

### 5. Linter Teszt

```bash
cd frontend
npm run lint
```

## ✅ Checklist

- [ ] Dev szerver elindul (`npm run dev`)
- [ ] Frontend elérhető `http://localhost:3000`
- [ ] API Status: ✅ Connected
- [ ] Minden endpoint elérhető (9 content type)
- [ ] Nincs TypeScript hiba
- [ ] Nincs linter hiba
- [ ] Environment változók beállítva

## 🐛 Troubleshooting

### Dev szerver nem indul

1. **Port foglalt:**
   ```bash
   # Windows
   netstat -ano | findstr :3000
   # Linux/Mac
   lsof -i :3000
   ```

2. **Node verzió:**
   ```bash
   node -v  # Kell: v20+
   ```

3. **Függőségek:**
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

### API kapcsolat nem működik

1. **Environment változók:**
   ```bash
   cd frontend
   cat .env.local
   ```

2. **Strapi elérhetőség:**
   ```bash
   curl https://cms.emermedia.eu/api/projects
   ```

3. **API token:**
   - Ellenőrizd a Strapi Admin Panel-ben
   - Settings → API Tokens
   - Token típus: Full access

### Build hibák

1. **TypeScript hibák:**
   ```bash
   cd frontend
   npx tsc --noEmit
   ```

2. **Missing dependencies:**
   ```bash
   cd frontend
   npm install
   ```

## 📊 Tesztelési Eredmények

**Utolsó teszt:** [Dátum]
- ✅ API kapcsolat: Működik
- ✅ 9/9 endpoint elérhető
- ✅ TypeScript: Nincs hiba
- ✅ Linter: Nincs hiba
