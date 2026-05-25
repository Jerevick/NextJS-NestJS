# LMS video transcode (HLS)

## Flow

1. Faculty uploads an MP4 via existing storage; `POST /lms/lessons/:lessonId/resources` with `fileType: video/mp4`.
2. API enqueues `lms-transcode` (BullMQ when `REDIS_URL` is set; otherwise inline).
3. Worker downloads the source, runs FFmpeg, uploads `index.m3u8` + `.ts` segments under `lms/hls/{institutionId}/{lessonId}/`.
4. Lesson `content` JSON is updated with `transcodeStatus`, `hlsUrl`, `hlsManifestKey`.

## Environment

| Variable                       | Description                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `REDIS_URL`                    | Enables BullMQ queue (required in production).                                 |
| `FFMPEG_PATH`                  | Optional path to `ffmpeg` binary (default: `ffmpeg` on PATH).                  |
| `TRANSCODE_MODE`               | `local` (FFmpeg, default) or `mediaconvert` (future AWS MediaConvert adapter). |
| `AWS_S3_BUCKET` / `AWS_REGION` | S3 upload for HLS artifacts; local fallback uses `BILLING_EVIDENCE_DIR`.       |

## Status values

- `PROCESSING` — job running
- `READY` — `hlsUrl` set; web `HlsVideoPlayer` can play
- `FAILED_TRANSCODE` — after 3 retries; see `transcodeError` in lesson content

## Web

`apps/web` reads `content.hlsUrl` (or legacy `playbackUrl` / `url`).
