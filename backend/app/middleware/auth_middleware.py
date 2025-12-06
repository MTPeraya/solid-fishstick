from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from typing import Callable
from ..utils.jwt import decode_access_token

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):

        if request.method == "OPTIONS":
            return await call_next(request)

        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
            try:
                payload = decode_access_token(token)
                request.state.user_id = payload.get("sub")
            except Exception:
                request.state.user_id = None
        else:
            request.state.user_id = None

        response = await call_next(request)
        return response
