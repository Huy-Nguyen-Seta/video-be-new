import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comment.controller';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
