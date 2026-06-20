# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/
from collections.abc import AsyncIterator

from strands import tool

from ..utils.a2a import stream_a2a_agent


def build_clevertap_tool(agent_runtime_arn: str, region: str, session_id: str):
    """Create a tool that delegates CleverTap tasks to the remote agent.

    [VI] Tạo một công cụ (tool) ủy thác các tác vụ CleverTap cho agent từ xa.
    """

    @tool
    async def clevertap_agent(request: str) -> AsyncIterator:
        """Send a marketing request to the CleverTap agent.

        Use this tool for any CleverTap-related tasks including:
        - Getting user profiles and event data
        - Viewing campaign statistics
        - Listing and creating user segments
        - Creating and managing draft campaigns

        Args:
            request: A natural language description of the marketing task.

        [VI] Gửi một yêu cầu marketing tới agent CleverTap.

        Dùng công cụ này cho mọi tác vụ liên quan tới CleverTap, bao gồm:
        - Lấy hồ sơ người dùng (user profile) và dữ liệu sự kiện
        - Xem thống kê chiến dịch
        - Liệt kê và tạo các phân khúc người dùng (segment)
        - Tạo và quản lý các chiến dịch nháp (draft campaign)

        Tham số:
            request: Mô tả tác vụ marketing bằng ngôn ngữ tự nhiên.
        """
        async for event in stream_a2a_agent(
            agent_runtime_arn,
            region,
            request,
            session_id,
        ):
            yield event

    return clevertap_agent
