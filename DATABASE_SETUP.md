# Database Setup Instructions

This project uses Cloudflare D1 database. To set it up:

## 1. Create D1 Database

Run in terminal:
```bash
npx wrangler d1 create cloudflare-demo-db
```

This will output a database_id. Copy it.

## 2. Update wrangler.toml

Replace the empty `database_id = ""` with the actual ID from step 1.

## 3. Initialize Database Schema

The API will automatically create the table on first request, but you can also run:

```bash
npx wrangler d1 execute cloudflare-demo-db --command "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
```

## 4. For Production Deployment

After deploying to Cloudflare Pages, you need to:
1. Go to Cloudflare Dashboard → Pages → cloudflare-demo → Settings
2. Go to Functions → D1 Database Bindings
3. Add binding: Variable name = `DB`, Database = `cloudflare-demo-db`

## 5. Local Development

Run:
```bash
npx wrangler pages dev . --d1=DB=cloudflare-demo-db
```

