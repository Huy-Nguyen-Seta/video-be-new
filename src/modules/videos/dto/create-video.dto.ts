import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, MaxLength, IsString, MinLength } from 'class-validator';

export class CreateVideoDto {
  @ApiProperty({ example: 'My Vacation Video' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description!: string;
}
