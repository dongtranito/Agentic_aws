import logging
import os

import uvicorn
from fastapi import FastAPI
from strands.multiagent.a2a import A2AServer

from .agent import get_talonone_agent

logging.basicConfig(level=logging.INFO)

runtime_url = os.environ.get("AGENTCORE_RUNTIME_URL", "http://127.0.0.1:9000/")

logging.info(f"Runtime URL: {runtime_url}")

strands_agent = get_talonone_agent()

host, port = "0.0.0.0", 9000

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

if __name__ == "__main__":
    uvicorn.run(app, host=host, port=port)
