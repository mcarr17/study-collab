FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm install

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
EXPOSE 8080
CMD ["npm", "start"]
