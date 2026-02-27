"""Smoke test for common package imports."""


def test_gateway_module_importable():
    from common.gateway import SigV4HTTPXAuth, get_gateway_mcp_client  # noqa: F401


def test_a2a_server_module_importable():
    from common.a2a_server import create_a2a_app, run_a2a_server  # noqa: F401
