# Deploy: Nebius Serverless Endpoint and Job

**Run this on the final day.** Nothing here has been executed yet; the Nebius CLI flags below come from SPEC §9 and
the Nebius docs and must be checked against `nebius ai endpoint create --help` and `nebius ai job create --help`.
The platform and preset ids come from `nebius ai platform list`.

## 1. Build and prove the image locally

```bash
docker build -t nimbus .
docker run --rm -p 3000:3000 -v nimbus-data:/data -e NIMBUS_API_TOKEN=change-me nimbus
curl -s localhost:3000/api/workstreams | head -c 200     # three workstreams
curl -s localhost:3000/v1/models -H 'authorization: Bearer change-me'
```

No key is needed: without `NEBIUS_API_KEY` the app uses the scripted mock model. To use real Nemotron models set
`NIMBUS_MODEL=nebius`, `NEBIUS_API_KEY` and `TAVILY_API_KEY`.

## 2. Push the image

```bash
# registry address from the Nebius console (Container Registry)
docker tag nimbus <registry>/nimbus:<tag>
docker push <registry>/nimbus:<tag>
```

## 3. Serverless Endpoint (the demo URL)

```bash
nebius ai endpoint create \
  --name nimbus \
  --image <registry>/nimbus:<tag> \
  --container-port 3000 \
  --env NIMBUS_MODEL=nebius \
  --env NEBIUS_API_KEY=... \
  --env TAVILY_API_KEY=... \
  --env NIMBUS_API_TOKEN=... \
  --platform <cpu platform> --preset <small> \
  --public
```

Creation takes about five minutes. The endpoint serves the web app and `POST /v1/chat/completions`.
Keep a Vercel or Railway deployment as the fallback demo URL (and say so in the Devpost feedback).

State: SQLite lives in `/data`. Attach a volume to the endpoint and to jobs that should share it. Without a volume the
database is lost when the container is replaced.

## 4. Serverless Job (a scheduled workstream, headless)

```bash
nebius ai job create \
  --name nimbus-nightly \
  --image <registry>/nimbus:<tag> \
  --container-command pnpm \
  --args run:job --args --workstream --args ws-radar --args --yes \
  --env NIMBUS_MODEL=nebius --env NEBIUS_API_KEY=... --env TAVILY_API_KEY=... \
  --timeout 1h
```

`--yes` approves low-risk actions only; riskier ones are rejected with a note, because a job has no person to ask.
The job runs inside the container on the same image; to hand results to the web app it must share the `/data` volume.
Check the job shows "completed" in the Nebius console.

## 5. Checks after deploy

- [ ] Endpoint URL loads the boot screen and the three workstreams.
- [ ] A run completes there (the first run on real models also validates the goldens' assertions; see README).
- [ ] `curl -N <url>/v1/chat/completions` with the bearer token streams a reply.
- [ ] One Serverless Job shows "completed".
