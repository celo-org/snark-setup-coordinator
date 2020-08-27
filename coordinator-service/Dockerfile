FROM node:12.18.3-alpine3.12 as base

ENV NPM_CONFIG_LOGLEVEL info

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy app
COPY . .

RUN npm run build

FROM node:12.18.3-alpine3.12

# Ensure we only install dependencies (not devDependencies too)
ENV NODE_ENV production
ENV NPM_CONFIG_LOGLEVEL info

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy build files
COPY --from=base /app/dist ./dist
COPY ceremony ceremony

CMD ["npm", "start"]
