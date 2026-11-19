import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from './generated/prisma/client';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapter: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const { httpAdapter } = this.adapter;

    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const message = typeof response === 'string' ? response
        : 'message' in response ? response.message : exception.message;
      httpAdapter.reply(context.getResponse(), { statusCode, message }, statusCode);
      return;
    }

    if (exception instanceof HttpException && [502, 504].includes(exception.getStatus())) {
      const statusCode = exception.getStatus();
      const message = statusCode === 504 ? 'The assessment provider timed out.'
        : 'The assessment provider failed or returned invalid output.';
      httpAdapter.reply(context.getResponse(), { statusCode, message }, statusCode);
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError &&
        (exception.code === 'P2002' || exception.code === 'P2003')) {
      httpAdapter.reply(context.getResponse(), {
        statusCode: 409,
        message: 'The submission conflicts with existing records.',
      }, 409);
      return;
    }

    this.logger.error('Unexpected API error.');
    httpAdapter.reply(context.getResponse(), {
      statusCode: 500,
      message: 'Internal server error.',
    }, 500);
  }
}
