# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/


def test_gateway_module_importable():
    from common.gateway import SigV4HTTPXAuth, get_gateway_mcp_client  # noqa: F401


def test_a2a_server_module_importable():
    from common.a2a_server import create_a2a_app, run_a2a_server  # noqa: F401
