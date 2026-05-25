import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import type { LmsTranscodeJobData } from './jobs/lms-transcode-jobs.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class LmsTranscodeService {
  private readonly log = new Logger(LmsTranscodeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  private async mergeLessonContent(
    lessonId: string,
    institutionId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const lesson = await this.prisma.lmsLesson.findFirst({
      where: { id: lessonId, institutionId, deletedAt: null },
      select: { content: true },
    });
    if (!lesson) {
      return;
    }
    const base =
      lesson.content && typeof lesson.content === 'object' && !Array.isArray(lesson.content)
        ? (lesson.content as Record<string, unknown>)
        : {};
    await this.prisma.lmsLesson.update({
      where: { id: lessonId },
      data: {
        content: { ...base, ...patch } as object,
        type: 'VIDEO',
      },
    });
  }

  async run(data: LmsTranscodeJobData): Promise<void> {
    const { lessonId, institutionId, sourceFileKey } = data;
    await this.mergeLessonContent(lessonId, institutionId, {
      transcodeStatus: 'PROCESSING',
      sourceFileKey,
    });

    const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
    let workDir: string | null = null;
    try {
      workDir = await mkdtemp(join(tmpdir(), 'unicore-lms-'));
      const inputPath = join(workDir, 'input.mp4');
      const outDir = join(workDir, 'hls');
      const { writeFile, mkdir } = await import('node:fs/promises');
      const localBuf = await this.storage.getBuffer(sourceFileKey);
      if (localBuf) {
        await writeFile(inputPath, localBuf);
      } else {
        const sourceUrl = await this.storage.resolveDownloadUrl(sourceFileKey);
        if (!sourceUrl) {
          throw new Error('Could not resolve source video URL');
        }
        if (sourceUrl.startsWith('file://')) {
          const { readFile } = await import('node:fs/promises');
          await writeFile(inputPath, await readFile(sourceUrl.replace('file://', '')));
        } else {
          const res = await fetch(sourceUrl);
          if (!res.ok) {
            throw new Error(`Download failed: ${res.status}`);
          }
          await writeFile(inputPath, Buffer.from(await res.arrayBuffer()));
        }
      }
      await mkdir(outDir, { recursive: true });
      await execFileAsync(
        ffmpeg,
        [
          '-i',
          inputPath,
          '-codec:v',
          'libx264',
          '-codec:a',
          'aac',
          '-hls_time',
          '10',
          '-hls_list_size',
          '0',
          '-hls_segment_filename',
          join(outDir, 'seg_%03d.ts'),
          join(outDir, 'index.m3u8'),
        ],
        { timeout: 600_000 },
      );
      const hlsPrefix = `lms/hls/${institutionId}/${lessonId}`;
      const manifestKey = `${hlsPrefix}/index.m3u8`;
      const { readFile, readdir } = await import('node:fs/promises');
      const manifest = await readFile(join(outDir, 'index.m3u8'));
      await this.storage.putBuffer(manifestKey, manifest, 'application/vnd.apple.mpegurl');
      const segments = await readdir(outDir);
      for (const name of segments) {
        if (!name.endsWith('.ts')) {
          continue;
        }
        const body = await readFile(join(outDir, name));
        await this.storage.putBuffer(`${hlsPrefix}/${name}`, body, 'video/mp2t');
      }
      const hlsUrl = await this.storage.resolveDownloadUrl(manifestKey);
      await this.mergeLessonContent(lessonId, institutionId, {
        transcodeStatus: 'READY',
        hlsManifestKey: manifestKey,
        hlsUrl: hlsUrl ?? undefined,
        sourceFileKey,
      });
      this.log.log(`Transcoded lesson ${lessonId} → ${manifestKey}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(`Transcode failed for ${lessonId}: ${message}`);
      await this.mergeLessonContent(lessonId, institutionId, {
        transcodeStatus: 'FAILED_TRANSCODE',
        transcodeError: message.slice(0, 500),
        sourceFileKey,
      });
    } finally {
      if (workDir) {
        await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }
}
