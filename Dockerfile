# Dockerfile (root van je repo)
FROM node:20-alpine

# Zet werkdirectory
WORKDIR /app

# Kopieer package.json van backend om dependencies te installeren
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Kopieer de volledige code
COPY . .

# Zet environment vars
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# ⬅️ Start het juiste bestand
CMD ["node", "backend/server.js"]
