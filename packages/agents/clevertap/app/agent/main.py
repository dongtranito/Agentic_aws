import logging

from common.a2a_server import create_a2a_app

from .agent import get_clevertap_agent

logging.basicConfig(level=logging.INFO)

app = create_a2a_app(get_clevertap_agent, agent_id="clevertap-agent")

if __name__ == "__main__":
    from common.a2a_server import run_a2a_server

    run_a2a_server(get_clevertap_agent, agent_id="clevertap-agent")
