import { IsString, MinLength } from 'class-validator';

/** Spec: POST /ai/meetings/generate-minutes */
export class GenerateAiMinutesDto {
  @IsString()
  meetingId!: string;

  @IsString()
  @MinLength(20)
  transcript!: string;
}
