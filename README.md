# Cloudflare Workers AI – Image to Image

## Setup
npm install -g wrangler
wrangler login
npm install

## Deploy
wrangler deploy

## Test
curl -X POST https://<your-worker>.workers.dev \
  -F "image=@test.png" \
  -F "prompt=Make this image cyberpunk style" \
  --output out.png
