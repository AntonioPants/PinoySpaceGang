# Deploying the game

The game is a static site. `Dockerfile` builds `web/` with Vite and serves it with nginx
(`deploy/nginx.conf`: gzip, long caching for hashed assets, `/healthz`).

Tim's Pi serves it at https://analog.timhufnagel.org (container `analog-atlas`, port 3021,
bound to 127.0.0.1 behind the Cloudflare tunnel). To update it:

    ssh timhuf@tim-pi 'cd ~/analog-atlas && git pull && docker compose up -d --build'

Run `pnpm build` and `pnpm test` in `web/` before pushing; the image build skips type
checking and tests to stay light on the Pi.
