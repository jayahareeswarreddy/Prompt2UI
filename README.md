## Asset Manager

Full‑stack asset management app built with an Express backend and a React (Vite) frontend.

### Tech stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Radix UI
- **DB / ORM**: PostgreSQL, Drizzle ORM

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- PostgreSQL database (only required if you run migrations)

### Getting started (local)

1. **Clone and install**

   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd Asset-Manager
   npm install
   ```

2. **Development mode (hot reload)**

   On **Windows / PowerShell** from the project root:

   ```powershell
   $env:NODE_ENV = "development"
   # Optional: choose a port (defaults to 5000)
   # $env:PORT = "5000"

   npx tsx server/index.ts
   ```

   Then open `http://localhost:5000` (or the port you chose).

3. **Production build & run locally**

   ```bash
   # from project root
   npm run build
   ```

   Then start the built server:

   - **On Linux/macOS**:

     ```bash
     NODE_ENV=production PORT=5000 node dist/index.cjs
     ```

   - **On Windows / PowerShell**:

     ```powershell
     $env:NODE_ENV = "production"
     $env:PORT = "5000"
     node dist/index.cjs
     ```

   Open `http://localhost:5000`.

### Database (optional)

If you want to run database migrations, set `DATABASE_URL` in your environment to a valid PostgreSQL connection string, then run:

```bash
npm run db:push
```

### Deployment

You can deploy this app to any Node‑capable host (e.g. Render, Fly.io, Railway).

**Typical configuration (Render example):**

- **Build command**: `npm install && npm run build`
- **Start command**: `npm start`
- **Environment variables**:
  - `NODE_ENV=production`
  - `PORT` – provided by the platform (the app already reads `process.env.PORT`)
  - `DATABASE_URL` – your PostgreSQL connection string (if using the DB)

After deployment, your live app will be accessible at the URL provided by your hosting platform. Add that URL to this README for grading, for example:

```text
Live demo: https://your-deployment-url.example.com
```

