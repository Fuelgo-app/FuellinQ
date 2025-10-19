# Dockerfile (root van de repo)
FROM node:20-alpine

# alleen backend deps cachen
WORKDIR /app/backend
COPY backend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# rest van de repo kopiëren (frontend mag mee)
WORKDIR /app
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# ⬅️ start het juiste pad
CMD ["node", "backend/server.js"]
