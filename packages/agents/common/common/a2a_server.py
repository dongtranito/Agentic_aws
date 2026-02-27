"""Shared A2A server factory for AgentCore Runtime agents."""

import logging
import os
from collections.abc import Callable

import uvicorn
from fastapi import FastAPI
from strands import Agent
from strands.multiagent.a2a import A2AServer

logger = logging.getLogger(__name__)


def create_a2a_app(agent_factory: Callable[[], Agent]) -> FastAPI:
    """Create a FastAPI app that serves a Strands agent over A2A.

    Args:
        agent_factory: A callable that returns a configured Strands Agent.
    """
    runtime_url = os.environ.get("AGENTCORE_RUNTIME_URL", "http://127.0.0.1:9000/")
    logger.info(f"Runtime URL: {runtime_url}")

    strands_agent = agent_factory()

    a2a_server = A2AServer(
        agent=strands_agent,
        http_url=runtime_url,
        serve_at_root=True,
    )

    app = FastAPI()

    @app.get("/ping")
    def ping():
        return {"status": "healthy"}

    app.mount("/", a2a_server.to_fastapi_app())
    return app


def run_a2a_server(agent_factory: Callable[[], Agent]) -> None:
    """Create and run an A2A server (blocking)."""
    app = create_a2a_app(agent_factory)
    uvicorn.run(app, host="0.0.0.0", port=9000)
