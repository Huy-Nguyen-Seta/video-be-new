import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@kt.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  password!: string;
}
