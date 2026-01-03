# Database Setup Instructions

✅ **Database is already configured!**

The D1 database `cloudflare-demo-db` has been created and initialized.

## Database Information

- **Database Name**: cloudflare-demo-db
- **Database ID**: 1c5802dd-3bd6-4804-9209-8bc4c26cc40b
- **Binding**: `DB`

## Tables Created

1. **items** - For database demo page
2. **chat_messages** - For chat demo page

## For Production Deployment

After deploying to Cloudflare Pages, you need to bind the database:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages → cloudflare-demo → Settings
2. Go to **Functions** → **D1 Database Bindings**
3. Add binding:
   - **Variable name**: `DB`
   - **Database**: `cloudflare-demo-db`

## Local Development

Run:
```bash
npx wrangler pages dev . --d1=DB=cloudflare-demo-db
```

## Manual Database Operations

### Query database:
```bash
npx wrangler d1 execute cloudflare-demo-db --remote --command "SELECT * FROM items"
```

### Execute SQL file:
```bash
npx wrangler d1 execute cloudflare-demo-db --remote --file=./schema.sql
```

