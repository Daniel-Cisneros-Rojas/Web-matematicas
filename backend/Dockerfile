FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
RUN apk del python3 make g++
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/database.sqlite
EXPOSE 3000
CMD ["npm", "start"]