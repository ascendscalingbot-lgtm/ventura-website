# Ventura Ask

Standalone VideoAsk-style intake player. Lives in the marketing site so it can ship as its own preview link now and move into the Ventura dashboard later.

## Preview

- Local: open `/videoask/` from the ventura-website static root
- Intended live path: `https://ventura-website-ruddy.vercel.app/videoask/`

## What this demo covers

Respondent flow only (the thing a lead actually takes):

1. Intro clip + Start
2. Mic / camera permission
3. Multiple-choice over video
4. Yes / No
5. Video, audio, or text reply
6. Done

Answers stay on-device. This is preview mode.

## References

Original VideoAsk screenshots (local only, gitignored): `references/originals/`

Compressed copies committed for later work: `references/*.jpg`

## Notes

- UI language follows the VideoAsk captures. Color, wordmark, and footer are Ventura (black + mint).
- Flow data is `flow.json` (OpenFlow-style step array: one screen per step).
- Host clip is a generated still with a short Ken Burns loop until a real Ventura talking-head is dropped on `assets/host-loop.mp4`.
