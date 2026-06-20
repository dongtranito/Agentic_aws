# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/
from collections.abc import AsyncIterator

from strands import tool

from ..utils.a2a import stream_a2a_agent


def build_talonone_tool(agent_runtime_arn: str, region: str, session_id: str):
    """Create a tool that delegates TalonOne tasks to the remote agent.

    [VI] Tạo một công cụ (tool) ủy thác các tác vụ TalonOne cho agent từ xa.
    """

    @tool
    async def talonone_agent(request: str) -> AsyncIterator:
        """Send a promotions request to the TalonOne agent.

        Use this tool for any TalonOne-related tasks including:
        - Managing promotion campaigns
        - Customer shopping sessions
        - Loyalty programs and point redemption
        - Coupon creation, listing, and validation

        Args:
            request: A natural language description of the promotions task.

        [VI] Gửi một yêu cầu khuyến mãi (promotions) tới agent TalonOne.

        Dùng công cụ này cho mọi tác vụ liên quan tới TalonOne, bao gồm:
        - Quản lý các chiến dịch khuyến mãi
        - Phiên mua sắm của khách hàng (customer shopping session)
        - Chương trình khách hàng thân thiết và đổi điểm thưởng
        - Tạo, liệt kê và xác thực mã giảm giá (coupon)

        Tham số:
            request: Mô tả tác vụ khuyến mãi bằng ngôn ngữ tự nhiên.
        """
        async for event in stream_a2a_agent(
            agent_runtime_arn,
            region,
            request,
            session_id,
        ):
            yield event

    return talonone_agent
