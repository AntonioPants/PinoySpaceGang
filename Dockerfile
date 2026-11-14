# The game is a static site: build it with Vite, serve it with nginx.
# Deployed on Tim's Pi as analog.timhufnagel.org (see deploy/README.md).
FROM node:22-alpine AS build
WORKDIR /src
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY web/package.json web/pnpm-lock.yaml web/
RUN cd web && pnpm install --frozen-lockfile
# the web app imports the physics engine, the 3D flight view and the weather data from outside web/
COPY app app
COPY data data
COPY web web
# type checking and tests run before a release, not on the Pi
RUN cd web && pnpm exec vite build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/web/dist /usr/share/nginx/html
EXPOSE 3021
