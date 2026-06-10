"""
Generic OpenAI-compatible provider implementation.

Works with any provider that follows the OpenAI API spec:
- Ollama, Together AI, Groq, Mistral, LM Studio, vLLM, etc.
Auth: Authorization: Bearer <key>
Base URL: User-defined
"""

import time

import httpx

from .base import BaseProvider


class GenericProvider(BaseProvider):
    name = "generic"
    base_url = ""  # Must be set by user

    def __init__(self, api_key: str, base_url: str, model: str = "default"):
        super().__init__(api_key, base_url)
        self.model = model

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
                    "model": self.model,
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
                # Try listing models first, fall back to minimal completion
                # Try a minimal completion (works for all OpenAI-compatible APIs)
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": "hi"}],
                        "max_tokens": 10,
                    },
                )
                response.raise_for_status()
                latency_ms = int((time.time() - start) * 1000)
                return {
                    "success": True,
                    "provider": self.name,
                    "model": self.model,
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
