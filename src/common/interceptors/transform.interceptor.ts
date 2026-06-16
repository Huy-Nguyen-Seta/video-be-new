import { NestInterceptor, CallHandler, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class TranformInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'meta' in payload &&
          'items' in payload
        ) {
          return {
            success: true,
            data: (payload as any).items,
            meta: (payload as any).meta,
          };
        }
        return {
          success: true,
          data: payload,
        };
      }),
    );
  }
}
