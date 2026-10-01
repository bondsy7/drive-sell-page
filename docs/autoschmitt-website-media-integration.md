# Auto Schmitt – Website-Media-API (read-only)

## Endpoint
`GET https://rauzclzphdnhzflovrya.supabase.co/functions/v1/website-media?target=autoschmitt&source=auto3&externalVehicleId=<AUTO3_ID>`

Header: `x-website-key: <AUTOHAUS_AI_MEDIA_KEY>` (server-to-server only, never in the browser).

## ENV
autohaus.ai (backend secrets):
- `WEBSITE_MEDIA_KEY_AUTOSCHMITT` – shared key (required)
- `WEBSITE_MEDIA_DEALER_AUTOSCHMITT` – optional user UUID of the dealer account; restricts lookup to that account

Schmitt project:
- `AUTOHAUS_AI_MEDIA_URL=https://rauzclzphdnhzflovrya.supabase.co/functions/v1/website-media`
- `AUTOHAUS_AI_MEDIA_KEY=<same value as WEBSITE_MEDIA_KEY_AUTOSCHMITT>`

## Responses
200 (only LIVE publications):
```json
{ "externalVehicleId": "12345", "coverMode": "ai", "galleryMode": "auto3",
  "coverImageUrl": "https://…/vehicle-images/….webp",
  "images": [], "updatedAt": "2026-10-01T20:00:00Z" }
```
- `coverMode`: `auto3` → use Auto3 cover (`coverImageUrl` = null); `ai` → use `coverImageUrl`
- `galleryMode`: `auto3` → Auto3 gallery unchanged (`images` = []); `append` → `images` first, then Auto3; `replace` → only `images`
- 404 `not_published` → fall back to Auto3 completely. 401 unauthorized, 400 invalid parameters.
No VIN, user data, prompts or metadata are returned. Cache: 60 s.
