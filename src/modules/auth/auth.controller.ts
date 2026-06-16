import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Body,
  HttpCode,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, AuthTokens } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { RefeshDto } from './dto/refesh.dto';
import { Request } from 'express';
import {
  AuthUser,
  CurrentUser,
} from 'src/common/decorators/current-user.decorator';

const REFESH_COOKIE = 'refreshToken';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      body.email,
      body.name,
      body.password,
    );
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(
    @Body() dto: RefeshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFESH_COOKIE] ?? dto.refreshToken;
    if (!token) return { accessToken: null };
    const tokens: AuthTokens = await this.authService.refesh(token);
    this.setRefreshTokenCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(userId, req.cookies?.[REFESH_COOKIE]);
    res.clearCookie(REFESH_COOKIE, { path: '/' });
    return { success: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user info' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(String(user?.id));
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    const isProduction = this.config.get<string>('nodeEnv') === 'production';
    res.cookie(REFESH_COOKIE, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}
