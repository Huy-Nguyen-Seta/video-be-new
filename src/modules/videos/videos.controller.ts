import {
  Controller,
  Param,
  Ip,
  Post,
  UseInterceptors,
  Body,
  UploadedFile,
  Patch,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideosService } from './videos.service';
import { ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { QueryVideoDto } from './dto/query-video.dto';
import { Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import {
  AuthUser,
  CurrentUser,
} from 'src/common/decorators/current-user.decorator';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get list of videos' })
  list(@Query() query: QueryVideoDto) {
    return this.videos.findAll(query);
  }

  @Public()
  @Get('hot')
  @ApiOperation({ summary: 'Get list of hot videos' })
  hot() {
    return this.videos.findHot();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get video details' })
  get(@Param('id') id: string) {
    return this.videos.findOne(id);
  }

  @Public()
  @Get(':id/view')
  @ApiOperation({ summary: 'Register a vie' })
  stream(@Param('id') id: string, @Ip() ip: string) {
    return this.videos.incrementViewCount(id, ip);
  }
  @ApiBearerAuth()
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a video' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVideoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.videos.create(user, dto, file);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update video details' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.videos.update(user, id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delte video' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.videos.remove(user, id);
  }
}
