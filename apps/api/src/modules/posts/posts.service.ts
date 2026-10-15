import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, anonAlias: true, isPremium: true, isLinked: true, gender: true, region: true } },
          _count: { select: { likes: true, comments: true } },
          likes: { where: { userId }, select: { id: true } },
        },
      }),
      this.prisma.post.count(),
    ]);

    return {
      data: posts.map(p => ({
        ...p,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        likedByMe: p.likes.length > 0,
        likes: undefined,
        _count: undefined,
      })),
      total,
      page,
      limit,
    };
  }

  async createPost(userId: string, content: string) {
    return this.prisma.post.create({
      data: { authorId: userId, content },
      include: {
        author: { select: { id: true, anonAlias: true, isPremium: true, isLinked: true, gender: true, region: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) throw new ForbiddenException('Not your post');
    await this.prisma.post.delete({ where: { id: postId } });
    return { success: true };
  }

  async toggleLike(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await this.prisma.postLike.delete({ where: { id: existing.id } });
      const count = await this.prisma.postLike.count({ where: { postId } });
      return { liked: false, likeCount: count };
    } else {
      await this.prisma.postLike.create({ data: { postId, userId } });
      const count = await this.prisma.postLike.count({ where: { postId } });
      return { liked: true, likeCount: count };
    }
  }

  async getPost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, anonAlias: true, isPremium: true, isLinked: true, gender: true, region: true } },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId }, select: { id: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return {
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      likedByMe: post.likes.length > 0,
      likes: undefined,
      _count: undefined,
    };
  }

  async getComments(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    return this.prisma.postComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, anonAlias: true, isPremium: true, isLinked: true, gender: true } },
      },
    });
  }

  async addComment(userId: string, postId: string, content: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    return this.prisma.postComment.create({
      data: { postId, authorId: userId, content },
      include: {
        author: { select: { id: true, anonAlias: true, isPremium: true, isLinked: true, gender: true } },
      },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.postComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) throw new ForbiddenException('Not your comment');
    await this.prisma.postComment.delete({ where: { id: commentId } });
    return { success: true };
  }
}
