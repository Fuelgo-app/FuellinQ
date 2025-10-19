# ---- FuellinQ backend build/run (monorepo: backend/ + frontend/) ----
FROM node:20-alpine

# 1) eerst alleen backend package files (snellere cache)
WORKDIR /app/backend
COPY backend/package*.json ./

# 2) prod dependencies voor backend
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# 3) kopieer de rest van de repo (frontend mag mee, is ok)
WORKDIR /app
COPY . .

# 4) runtime env
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# 5) start jouw backend/server.js
CMD ["node", "backend/server.js"]
