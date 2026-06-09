"""
Anthropic (Claude) provider implementation.

Supports: Claude 3.5 Sonnet, Claude 3 Opus, etc.
Auth: x-api-key header
Base URL: https://api.anthropic.com
"""

import time

import httpx

from .base import BaseProvider


class AnthropicProvider(BaseProvider):
    name = "anthropic"
    base_url = "https://api.anthropic.com"

    def __init__(self, api_key: str, base_url: str | None = None):
        super().__init__(api_key, base_url)

    async def complete(
        self,
        prompt: str,
        system: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> str:
        body: dict = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            body["system"] = system

        async with self._get_client() as client:
            response = await client.post(
                f"{self.base_url}/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            response.raise_for_status()
            data = response.json()
            # Anthropic returns content as a list of blocks
            content_blocks = data.get("content", [])
            return "".join(
                block.get("text", "") for block in content_blocks if block.get("type") == "text"
            )

    async def test_connection(self) -> dict:
        start = time.time()
        try:
            async with self._get_client() as client:
                response = await client.post(
                    f"{self.base_url}/v1/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 10,
                        "messages": [{"role": "user", "content": "hi"}],
                    },
                )
                response.raise_for_status()
                latency_ms = int((time.time() - start) * 1000)
                return {
                    "success": True,
                    "provider": self.name,
                    "model": "claude-sonnet-4-20250514",
                    "latency_ms": latency_ms,
                }
        except httpx.HTTPStatusError as e:
            latency_ms = int((time.time() - start) * 1000)
            return {
                "success": False,
                "provider": self.name,
                "error": str(e),
                "latency_ms": latency_ms,
            }
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000)
            return {
                "success": False,
                "provider": self.name,
                "error": str(e),
                "latency_ms": latency_ms,
            }
