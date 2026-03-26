# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/

import json
import logging
import os

import boto3

logger = logging.getLogger(__name__)

_ssm_client = None


def _get_ssm_client():
    global _ssm_client
    if _ssm_client is None:
        _ssm_client = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return _ssm_client


def load_configuration() -> dict:
    """Load the agent configuration from SSM Parameter Store.

    Reads the AGENT_CONFIG_PARAMETER env var to find the SSM parameter name,
    then fetches and parses the JSON config.

    Returns the configuration dict, or an empty dict if not configured.
    """
    param_name = os.environ.get("AGENT_CONFIG_PARAMETER")
    if not param_name:
        logger.debug("AGENT_CONFIG_PARAMETER not set, using defaults")
        return {}

    try:
        response = _get_ssm_client().get_parameter(Name=param_name)
        config = json.loads(response["Parameter"]["Value"])
        logger.info("Loaded agent config from %s", param_name)
        return config
    except _get_ssm_client().exceptions.ParameterNotFound:
        logger.debug("Config parameter %s not found, using defaults", param_name)
        return {}
    except Exception:
        logger.warning("Failed to load agent config from %s, using defaults", param_name, exc_info=True)
        return {}
