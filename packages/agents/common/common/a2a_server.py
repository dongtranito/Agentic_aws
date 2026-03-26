# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/

import logging
import os
from collections.abc import Callable

import uvicorn
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from strands import Agent
from strands.multiagent.a2a import A2AServer

from .s3_artifact import S3ArtifactHook, current_session_id

logger = logging.getLogger(__name__)


class SessionIdMiddleware(BaseHTTPMiddleware):
    """Middleware that extracts the AgentCore Runtime session ID from the
    request header and sets it in a context variable so the S3 artifact
    hook can read it."""

    async def dispatch(self, request: Request, call_next):
        session_id = request.headers.get("x-amzn-bedrock-agentcore-runtime-session-id", "unknown")
        logger.info(f"SessionIdMiddleware: session_id={session_id}, path={request.url.path}")
        token = current_session_id.set(session_id)
        try:
            return await call_next(request)
        finally:
            current_session_id.reset(token)


def create_a2a_app(
    agent_factory: Callable[[], Agent],
    agent_id: str | None = None,
    artifact_bucket: str | None = None,
) -> FastAPI:
    """Create a FastAPI app that serves a Strands agent over A2A.

    Args:
        agent_factory: A callable that returns a configured Strands Agent.
        agent_id: Identifier for this agent (used for S3 artifact path).
            If provided along with artifact_bucket, enables S3 artifact persistence.
        artifact_bucket: S3 bucket name for storing conversation artifacts.
    """
    runtime_url = os.environ.get("AGENTCORE_RUNTIME_URL", "http://127.0.0.1:9000/")
    logger.info(f"Runtime URL: {runtime_url}")

    strands_agent = agent_factory()

    # Register S3 artifact hook if configured
    if agent_id and (artifact_bucket or os.environ.get("ARTIFACT_BUCKET")):
        hook = S3ArtifactHook(agent_id=agent_id, artifact_bucket=artifact_bucket)
        hook.register(strands_agent.hooks)

    a2a_server = A2AServer(
        agent=strands_agent,
        http_url=runtime_url,
        serve_at_root=True,
    )

    app = FastAPI()
    app.add_middleware(SessionIdMiddleware)

    @app.get("/ping")
    def ping():
        return {"status": "healthy"}

    app.mount("/", a2a_server.to_fastapi_app())
    return app


def run_a2a_server(
    agent_factory: Callable[[], Agent],
    agent_id: str | None = None,
    artifact_bucket: str | None = None,
) -> None:
    """Create and run an A2A server (blocking)."""
    app = create_a2a_app(agent_factory, agent_id=agent_id, artifact_bucket=artifact_bucket)
    uvicorn.run(app, host="0.0.0.0", port=9000)
