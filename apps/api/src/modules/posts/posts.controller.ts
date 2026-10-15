import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PostsService } from './posts.service';
import { IsString, MaxLength, MinLength } from 'class-validator';

class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}

class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content: string;
}

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  getFeed(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.postsService.getFeed(user.id, +page, +limit);
  }

  @Post()
  createPost(@CurrentUser() user: User, @Body() dto: CreatePostDto) {
    return this.postsService.createPost(user.id, dto.content);
  }

  @Delete(':id')
  deletePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.postsService.deletePost(user.id, id);
  }

  @Post(':id/like')
  toggleLike(@CurrentUser() user: User, @Param('id') id: string) {
    return this.postsService.toggleLike(user.id, id);
  }

  @Get(':id/comments')
  getComments(@Param('id') id: string) {
    return this.postsService.getComments(id);
  }

  @Get(':id')
  getPost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.postsService.getPost(user.id, id);
  }

  @Post(':id/comments')
  addComment(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.postsService.addComment(user.id, id, dto.content);
  }

  @Delete('comments/:commentId')
  deleteComment(@CurrentUser() user: User, @Param('commentId') commentId: string) {
    return this.postsService.deleteComment(user.id, commentId);
  }
}
