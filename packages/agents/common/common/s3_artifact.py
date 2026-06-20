# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/

"""
Shared S3 Artifact Hook for storing conversation artifacts to S3.

This hook saves conversation messages to S3 for archival/audit purposes.
It can be used by any agent (orchestrator or worker) by providing the
agent_id and artifact_bucket.

S3 structure:
/<bucket>/
└── <session_id>/
    └── <agent_id>/
        ├── agent.json
        └── messages/
            ├── message_0.json
            └── message_1.json

[VI] Hook (móc nối) S3 Artifact dùng chung để lưu các artifact hội thoại lên S3.

Hook này lưu các tin nhắn hội thoại lên S3 phục vụ mục đích lưu trữ/kiểm toán.
Bất kỳ agent nào (orchestrator hoặc worker) đều có thể dùng nó bằng cách cung cấp
agent_id và artifact_bucket.

Cấu trúc trên S3:
/<bucket>/
└── <session_id>/
    └── <agent_id>/
        ├── agent.json
        └── messages/
            ├── message_0.json
            └── message_1.json
"""

import json
import os
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

import boto3
from strands.hooks import MessageAddedEvent
from strands.hooks.registry import HookRegistry
from strands.types.content import ContentBlock

# Context variable to pass session ID from request middleware to the hook
# [VI] Biến ngữ cảnh (context variable) để truyền session ID từ middleware của request sang hook
current_session_id: ContextVar[str] = ContextVar("current_session_id", default="unknown")

REGION = os.environ.get("AWS_REGION", "us-east-1")


class S3ArtifactHook:
    """Hook that saves conversation artifacts to S3.

    For worker agents served via A2A, the session_id is read from the
    `current_session_id` context variable which is set by the A2A server
    middleware on each request.

    Args:
        agent_id: Identifier for this agent (e.g. "orchestrator", "databricks-agent").
        artifact_bucket: S3 bucket name. If not provided, reads from ARTIFACT_BUCKET env var.

    [VI] Hook lưu các artifact hội thoại lên S3.

    Đối với các worker agent được phục vụ qua A2A, session_id được đọc từ
    biến ngữ cảnh `current_session_id` mà middleware của A2A server thiết lập
    trên mỗi request.

    Tham số:
        agent_id: Định danh của agent này (vd: "orchestrator", "databricks-agent").
        artifact_bucket: Tên bucket S3. Nếu không cung cấp, sẽ đọc từ biến môi trường ARTIFACT_BUCKET.
    """

    def __init__(self, agent_id: str, artifact_bucket: str | None = None):
        self.agent_id = agent_id
        self.artifact_bucket = artifact_bucket or os.environ.get("ARTIFACT_BUCKET", "")
        self.s3_client = boto3.client("s3", region_name=REGION)
        self._message_counters: dict[str, int] = {}
        self._initialized_sessions: set[str] = set()

    def register(self, registry: HookRegistry) -> None:
        """Register hooks with the agent's hook registry.

        [VI] Đăng ký các hook vào registry hook của agent.
        """
        registry.add_callback(MessageAddedEvent, self._on_message_added)
        # [VI] Thông báo hook artifact S3 đã được đăng ký cho agent
        print(f"S3 artifact hook registered for agent '{self.agent_id}'")

    def _get_session_id(self) -> str:
        """Get the current session ID from context.

        [VI] Lấy session ID hiện tại từ ngữ cảnh.
        """
        return current_session_id.get()

    def _get_prefix(self, session_id: str) -> str:
        return f"{session_id}/{self.agent_id}"

    def _get_message_index(self, session_id: str) -> int:
        """Get and increment the message index for a session.

        [VI] Lấy và tăng chỉ số (index) tin nhắn cho một phiên làm việc.
        """
        if session_id not in self._message_counters:
            # Check S3 for existing messages
            # [VI] Kiểm tra trên S3 xem đã có tin nhắn nào tồn tại chưa
            self._message_counters[session_id] = self._count_existing_messages(session_id)
        idx = self._message_counters[session_id]
        self._message_counters[session_id] = idx + 1
        return idx

    def _count_existing_messages(self, session_id: str) -> int:
        """Count existing messages in S3 for this session/agent.

        [VI] Đếm số tin nhắn đã tồn tại trên S3 cho phiên/agent này.
        """
        try:
            prefix = f"{self._get_prefix(session_id)}/messages/"
            response = self.s3_client.list_objects_v2(
                Bucket=self.artifact_bucket,
                Prefix=prefix,
            )
            if "Contents" not in response:
                return 0
            max_index = -1
            for obj in response["Contents"]:
                filename = obj["Key"].split("/")[-1]
                if filename.startswith("message_") and filename.endswith(".json"):
                    try:
                        index = int(filename[8:-5])
                        max_index = max(max_index, index)
                    except ValueError:
                        continue
            return max_index + 1
        except Exception as e:
            # [VI] Cảnh báo: không lấy được chỉ số tin nhắn từ S3
            print(f"Warning: Failed to get message index from S3: {e}")
            return 0

    def _ensure_session_initialized(self, session_id: str) -> None:
        """Create agent.json if not already created for this session.

        [VI] Tạo file agent.json nếu chưa được tạo cho phiên làm việc này.
        """
        if session_id in self._initialized_sessions:
            return
        try:
            agent_key = f"{self._get_prefix(session_id)}/agent.json"
            try:
                self.s3_client.head_object(Bucket=self.artifact_bucket, Key=agent_key)
                self._initialized_sessions.add(session_id)
                return
            except self.s3_client.exceptions.ClientError:
                pass

            agent_data = {
                "agent_id": self.agent_id,
                "session_id": session_id,
                "created_at": datetime.now(UTC).isoformat(),
            }
            self.s3_client.put_object(
                Bucket=self.artifact_bucket,
                Key=agent_key,
                Body=json.dumps(agent_data, default=str),
                ContentType="application/json",
            )
            self._initialized_sessions.add(session_id)
        except Exception as e:
            # [VI] Cảnh báo: không khởi tạo được phiên làm việc trên S3
            print(f"Warning: Failed to initialize session in S3: {e}")

    @staticmethod
    def _serialize_content(content: list[ContentBlock]) -> list[dict[str, Any]]:
        """Serialize content blocks to JSON-safe format.

        [VI] Chuyển các khối nội dung (content block) sang định dạng an toàn với JSON.
        """
        result = []
        for block in content:
            if hasattr(block, "model_dump"):
                result.append(block.model_dump())
            elif isinstance(block, dict):
                result.append(block)
            else:
                result.append({"type": "unknown", "value": str(block)})
        return result

    def _on_message_added(self, event: MessageAddedEvent) -> None:
        """Save message to S3 when added to conversation.

        [VI] Lưu tin nhắn lên S3 khi nó được thêm vào cuộc hội thoại.
        """
        if not self.artifact_bucket:
            return
        session_id = self._get_session_id()
        if session_id == "unknown":
            return
        try:
            self._ensure_session_initialized(session_id)
            message = event.message
            message_data = {
                "role": message.get("role", "unknown"),
                "content": self._serialize_content(message.get("content", [])),
            }
            idx = self._get_message_index(session_id)
            key = f"{self._get_prefix(session_id)}/messages/message_{idx}.json"
            self.s3_client.put_object(
                Bucket=self.artifact_bucket,
                Key=key,
                Body=json.dumps(message_data, default=str),
                ContentType="application/json",
            )
        except Exception as e:
            # [VI] Cảnh báo: không lưu được artifact tin nhắn lên S3
            print(f"Warning: Failed to save message artifact to S3: {e}")
