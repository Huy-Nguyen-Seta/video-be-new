import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';

    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as Record<string, any>;
        message = body.message ?? exception.message;
        error = body.error ?? exception.name;
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      ({ status, message, error } = this.mapPrismaError(exception));
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    if (status >= 500) {
      this.logger.error(
        `Request ${request.method} ${request.url} failed with status ${status}: ${message}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      success: false,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Duplicate value',
          error: 'Conflict',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Data not found',
          error: 'NotFound',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Related resouce not exist',
          error: 'BadRequest',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'Database Errors',
        };
    }
  }
}
