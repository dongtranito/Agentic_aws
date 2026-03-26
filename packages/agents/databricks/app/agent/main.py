# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/
import logging

from common.a2a_server import create_a2a_app

from .agent import get_databricks_agent

logging.basicConfig(level=logging.INFO)

app = create_a2a_app(get_databricks_agent, agent_id="databricks-agent")

if __name__ == "__main__":
    from common.a2a_server import run_a2a_server

    run_a2a_server(get_databricks_agent, agent_id="databricks-agent")
