import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'This is a comment.' })
  @IsString()
  @MinLength(2000)
  content!: string;

  @ApiPropertyOptional({ description: 'Parent comment id when reply' })
  @IsOptional()
  @IsUUID()
  parentId!: string;
}
