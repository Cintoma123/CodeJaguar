"""
OpenAI provider implementation.

Supports: GPT-4o, GPT-4, GPT-3.5-turbo, etc.
Auth: Authorization: Bearer <key>
Base URL: https://api.openai.com/v1
"""

import time

import httpx

from .base import BaseProvider


class OpenAIProvider(BaseProvider):
    name = "openai"
    base_url = "https://api.openai.com/v1"

    def __init__(self, api_key: str, base_url: str | None = None):
        super().__init__(api_key, base_url)

    async def complete(
        self,
        prompt: str,
        system: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with self._get_client() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o",
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def test_connection(self) -> dict:
        start = time.time()
        try:
            async with self._get_client() as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                response.raise_for_status()
                latency_ms = int((time.time() - start) * 1000)
                return {
                    "success": True,
                    "provider": self.name,
                    "model": "gpt-4o",
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
