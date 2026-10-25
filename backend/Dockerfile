FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/database.sqlite
EXPOSE 3000
CMD ["npm", "start"]