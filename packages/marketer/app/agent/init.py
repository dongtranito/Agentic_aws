from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel
from starlette.middleware.exceptions import ExceptionMiddleware


class InternalServerErrorDetails(BaseModel):
    detail: str


app = FastAPI(title="MarketerAgent", responses={500: {"model": InternalServerErrorDetails}})

# Add cors middleware
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Add exception middleware(s)
app.add_middleware(ExceptionMiddleware, handlers=app.exception_handlers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("=== VALIDATION ERROR ===")
    print(f"URL: {request.url}")
    print(f"Method: {request.method}")
    print(f"Headers: {dict(request.headers)}")
    body = await request.body()
    print(f"Body: {body}")
    print(f"Errors: {exc.errors()}")
    print("=== END VALIDATION ERROR ===")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, err):
    print(request)
    print(err)
    return JSONResponse(
        status_code=500, content=InternalServerErrorDetails(detail="Internal Server Error").model_dump()
    )


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    for route in app.routes:
        if isinstance(route, APIRoute):
            route.operation_id = route.name
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
