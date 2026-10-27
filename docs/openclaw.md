# Nimbus inside your chat apps (OpenClaw, Hermes, NemoClaw)

Nimbus exposes an OpenAI-compatible endpoint, so any chat gateway with a custom-provider setting can use it.
There is no bridge code: the gateway sends chat completions, Nimbus runs a crew and streams the answer.

| | |
|---|---|
| Endpoint | `POST /v1/chat/completions` (streaming and non-streaming), `GET /v1/models` |
| Auth | `Authorization: Bearer $NIMBUS_API_TOKEN`. If the variable is empty the endpoint is open in dev and closed in production. |
| Model | `nimbus/<workstream>`: `nimbus/ship-nimbus`, `nimbus/hackathon-radar`, `nimbus/morning-brief`, `nimbus/cost-audit`, `nimbus/release-watch`, `nimbus/checkout-drop` (default when unknown: ship-nimbus) |
| Message | The last user message becomes the run's goal. |
| Reply | A plan line, then the Writer's final document. If the crew needs an approval or asks a question, the reply ends with `⚠ Needs your approval: <summary> → <web composer URL>` and the run waits there. Approvals never happen in chat. |

## Status: what has and has not been tested

- **Tested with curl** against the mock model (`NIMBUS_MODEL=mock`): streaming, non-streaming, bearer check, the approval notice, and the deep link `/?run=<id>` opening that run. See "Try it" below.
- **Not tested** with a real OpenClaw install, and not with the real Token Factory models (the mock model is the default until `NEBIUS_API_KEY` is set).
- The `${NIMBUS_API_TOKEN}` env substitution in the OpenClaw config is from OpenClaw's docs and has not been checked on an install.

## OpenClaw config (`~/.openclaw/openclaw.json`)

Nimbus as the provider:

```json
{ "models": { "mode": "merge", "providers": { "nimbus": {
  "baseUrl": "https://<your-nimbus-host>/v1", "apiKey": "${NIMBUS_API_TOKEN}",
  "api": "openai-completions",
  "models": [
    { "id": "nimbus/checkout-drop", "name": "Nimbus · Checkout drop", "input": ["text"], "contextWindow": 256000, "maxTokens": 8192 },
    { "id": "nimbus/morning-brief",  "name": "Nimbus · Morning brief",  "input": ["text"], "contextWindow": 256000, "maxTokens": 8192 }
  ] } } } }
```

Token Factory directly (shows the model path; no Nimbus involved):

```json
"nebius": { "baseUrl": "https://api.tokenfactory.nebius.com/v1", "apiKey": "${NEBIUS_API_KEY}",
  "api": "openai-completions",
  "models": [{ "id": "nvidia/nemotron-3-super-120b-a12b", "name": "Nemotron 3 Super",
               "reasoning": true, "input": ["text"], "contextWindow": 256000, "maxTokens": 32768 }] }
```

Hermes and NemoClaw take the same base URL and key through their "custom OpenAI-compatible provider" setting.

## Try it

```bash
pnpm dev                      # mock model, no keys
curl -N http://localhost:3000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"nimbus/checkout-drop","stream":true,"messages":[{"role":"user","content":"Why did checkout conversion drop on Oct 14?"}]}'
```

You get a plan line and then either the document or a `⚠ Needs your approval … → http://localhost:3000/?run=run_…` line.
Open that link, approve in the composer, and the run continues. "Approve & always allow" stops the notice on later runs.
