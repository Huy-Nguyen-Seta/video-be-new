import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn, IsEnum } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/paginnation.dto';
import { VideoStatus } from '@prisma/client';

export const VIDEO_SORT_FIELDS = ['createdAt', 'viewCount', 'title'] as const;
export type VideoSortField = (typeof VIDEO_SORT_FIELDS)[number];

export class QueryVideoDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Full-text-ish search on title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: VideoStatus })
  @IsOptional()
  @IsEnum(VideoStatus)
  status?: VideoStatus;

  @ApiPropertyOptional({ description: 'Filter by owner id' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by owner id',
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(VIDEO_SORT_FIELDS)
  sortBy: VideoSortField = 'createdAt';
}
