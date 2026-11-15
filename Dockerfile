FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

FROM base AS production-dependencies
RUN npm ci --omit=dev

FROM base
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3003
CMD ["node", "dist/main.js"]
