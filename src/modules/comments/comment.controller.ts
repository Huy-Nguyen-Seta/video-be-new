import {
  Controller,
  Get,
  Query,
  Param,
  Post,
  Body,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { PaginationQueryDto } from 'src/common/dto/paginnation.dto';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  AuthUser,
  CurrentUser,
} from 'src/common/decorators/current-user.decorator';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}
  @Public()
  @Get('videos:/:videoId/comments')
  @ApiOperation({ summary: 'List comments for a video' })
  list(@Param('videoId') videoId: string, @Query() query: PaginationQueryDto) {
    return this.commentsService.listForVideo(videoId, query);
  }

  @ApiBearerAuth()
  @Post('videos:/:videoId/comments')
  @ApiOperation({ summary: 'Create a comment for a video' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('videoId') videoId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(
      user,
      videoId,
      dto.content,
      dto.parentId,
    );
  }

  @ApiBearerAuth()
  @Patch('comments/:id')
  @ApiOperation({ summary: 'Update a comment for a video' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('videoId') videoId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(user, videoId, dto.content);
  }

  @ApiBearerAuth()
  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete a comment for a video' })
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commentsService.remove(user, id);
  }
}
