FROM node:20-alpine

WORKDIR /app

# Alleen package files kopiëren voor snellere layer cache
COPY package*.json ./

# Prod dependencies (val terug op npm install als geen lockfile)
RUN npm ci --omit=dev || npm install --omit=dev

# Rest van de code
COPY . .

ENV NODE_ENV=production

# Railway levert $PORT; jouw server moet daarop luisteren (0.0.0.0)
CMD ["node", "server.js"]
