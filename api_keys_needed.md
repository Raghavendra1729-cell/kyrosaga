# 🔑 Exact API Keys / Environment Variables Needed for Cloud

You MUST inject these exact environment variables into the production environment settings on your cloud provider (e.g., Hugging Face Spaces Secrets). Do NOT put these in the codebase or Dockerfile.

### 1. Database
* `DATABASE_URL` (Your cloud Supabase connection string)

### 2. Gemini AI
* `GEMINI_API_KEY`
* `GEMINI_EMBEDDING_MODEL_ID` (Optional, defaults to gemini-embedding-2 but you can set if you want to override)

### 3. Cloud Storage (Crucial for production)
* `STORAGE_DRIVER` (Set this exactly to: `r2`)
* `R2_ACCOUNT_ID`
* `R2_ACCESS_KEY_ID`
* `R2_SECRET_ACCESS_KEY`
* `R2_BUCKET_NAME`
* `R2_PUBLIC_URL`

### 4. Analytics (Optional but good for the assignment)
* `POSTHOG_API_KEY`
* `POSTHOG_HOST` (Set to `https://us.i.posthog.com`)
