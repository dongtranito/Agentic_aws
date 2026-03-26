# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/

from collections.abc import Generator
from typing import Any

import boto3
import httpx
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest


class SigV4HTTPXAuth(httpx.Auth):
    """HTTPX Auth class that signs requests with AWS SigV4."""

    def __init__(
        self,
        credentials: Any | None = None,
        region: str | None = None,
        service: str = "bedrock-agentcore",
    ):
        if credentials is None:
            session = boto3.Session()
            credentials = session.get_credentials()
            if credentials is None:
                raise ValueError("No AWS credentials found.")

        if region is None:
            session = boto3.Session()
            region = session.region_name
            if region is None:
                raise ValueError("No AWS region found.")

        self.credentials = credentials
        self.service = service
        self.region = region
        self.signer = SigV4Auth(credentials, service, region)

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        headers = dict(request.headers)
        headers.pop("connection", None)

        aws_request = AWSRequest(
            method=request.method,
            url=str(request.url),
            data=request.content,
            headers=headers,
        )
        self.signer.add_auth(aws_request)

        request.headers.update(dict(aws_request.headers))
        yield request
