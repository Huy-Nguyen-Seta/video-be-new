import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MinLength, IsString, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'huydz@dev.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Huy dz' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'password', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(80)
  password!: string;
}
