import { IsDateString } from 'class-validator';

export class IssueSessionQrDto {
  /** Calendar day or full ISO datetime; date portion anchors the attendance session key. */
  @IsDateString()
  sessionDate!: string;
}
