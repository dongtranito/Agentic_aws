"""
S3 Artifact Hook for storing conversation artifacts to S3.

This hook saves conversation messages to S3 for archival/audit purposes,
following the same structure as Strands FileSessionManager:

/<bucket>/
└── <session_id>/
    ├── session.json                # Session metadata
    └── agents/
        └── agent_<agent_id>/
            ├── agent.json          # Agent metadata
            └── messages/
                ├── message_0.json
                └── message_1.json

It does NOT restore from S3 - that's handled by AgentCore Memory.
"""

import json
import os
from datetime import UTC, datetime
from typing import Any

import boto3
from strands.hooks import MessageAddedEvent
from strands.hooks.registry import HookRegistry
from strands.types.content import ContentBlock

ARTIFACT_BUCKET = os.environ["ARTIFACT_BUCKET"]
REGION = os.environ.get("AWS_REGION", "us-east-1")
AGENT_ID = "marketer"  # Fixed agent ID for this application


class S3ArtifactHook:
    """Hook that saves conversation artifacts to S3 following FileSessionManager structure."""

    def __init__(self, session_id: str, actor_id: str):
        self.session_id = session_id
        self.actor_id = actor_id
        self.s3_client = boto3.client("s3", region_name=REGION)
        self.message_index = self._get_next_message_index()
        self._session_initialized = False

    def _get_next_message_index(self) -> int:
        """Get the next message index by checking existing messages in S3."""
        try:
            prefix = f"{self._get_agent_prefix()}/messages/"
            response = self.s3_client.list_objects_v2(
                Bucket=ARTIFACT_BUCKET,
                Prefix=prefix,
            )

            if "Contents" not in response:
                return 0

            # Find the highest message index
            max_index = -1
            for obj in response["Contents"]:
                key = obj["Key"]
                # Extract index from message_<index>.json
                filename = key.split("/")[-1]
                if filename.startswith("message_") and filename.endswith(".json"):
                    try:
                        index = int(filename[8:-5])  # Remove "message_" and ".json"
                        max_index = max(max_index, index)
                    except ValueError:
                        continue

            return max_index + 1
        except Exception as e:
            print(f"Warning: Failed to get message index from S3: {e}")
            return 0

    def register(self, registry: HookRegistry) -> None:
        """Register hooks with the agent's hook registry."""
        registry.add_callback(MessageAddedEvent, self._on_message_added)
        print(f"S3 artifact hook registered for session {self.session_id}, starting at message {self.message_index}")

    def _get_session_prefix(self) -> str:
        """Get S3 prefix for session directory."""
        return self.session_id

    def _get_agent_prefix(self) -> str:
        """Get S3 prefix for agent directory."""
        return f"{self._get_session_prefix()}/agents/agent_{AGENT_ID}"

    def _get_message_key(self, message_id: int) -> str:
        """Get S3 key for a message file."""
        return f"{self._get_agent_prefix()}/messages/message_{message_id}.json"

    def _serialize_content(self, content: list[ContentBlock]) -> list[dict[str, Any]]:
        """Serialize content blocks to JSON-safe format."""
        result = []
        for block in content:
            if hasattr(block, "model_dump"):
                result.append(block.model_dump())
            elif isinstance(block, dict):
                result.append(block)
            else:
                result.append({"type": "unknown", "value": str(block)})
        return result

    def _ensure_session_initialized(self) -> None:
        """Create session.json and agent.json if not already created."""
        if self._session_initialized:
            return

        try:
            now = datetime.now(UTC).isoformat()

            # Check if session.json already exists
            session_key = f"{self._get_session_prefix()}/session.json"
            try:
                self.s3_client.head_object(Bucket=ARTIFACT_BUCKET, Key=session_key)
                # Session already exists, just mark as initialized
                self._session_initialized = True
                return
            except self.s3_client.exceptions.ClientError:
                pass  # Session doesn't exist, create it

            # Write session.json
            session_data = {
                "session_id": self.session_id,
                "actor_id": self.actor_id,
                "created_at": now,
            }
            self.s3_client.put_object(
                Bucket=ARTIFACT_BUCKET,
                Key=session_key,
                Body=json.dumps(session_data, default=str),
                ContentType="application/json",
            )

            # Write agent.json
            agent_data = {
                "agent_id": AGENT_ID,
                "session_id": self.session_id,
                "created_at": now,
            }
            self.s3_client.put_object(
                Bucket=ARTIFACT_BUCKET,
                Key=f"{self._get_agent_prefix()}/agent.json",
                Body=json.dumps(agent_data, default=str),
                ContentType="application/json",
            )

            self._session_initialized = True
        except Exception as e:
            print(f"Warning: Failed to initialize session in S3: {e}")

    def _on_message_added(self, event: MessageAddedEvent) -> None:
        """Save message to S3 when added to conversation."""
        try:
            self._ensure_session_initialized()

            message = event.message
            message_data = {
                "role": message.get("role", "unknown"),
                "content": self._serialize_content(message.get("content", [])),
            }

            key = self._get_message_key(self.message_index)
            self.s3_client.put_object(
                Bucket=ARTIFACT_BUCKET,
                Key=key,
                Body=json.dumps(message_data, default=str),
                ContentType="application/json",
            )
            self.message_index += 1
        except Exception as e:
            print(f"Warning: Failed to save message artifact to S3: {e}")
