"""
Google Gemini provider implementation.

Supports: Gemini 1.5 Pro, Gemini 1.5 Flash, etc.
Auth: API key in URL query parameter
Base URL: https://generativelanguage.googleapis.com
"""

import time

import httpx

from .base import BaseProvider


class GeminiProvider(BaseProvider):
    name = "gemini"
    base_url = "https://generativelanguage.googleapis.com"

    def __init__(self, api_key: str, base_url: str | None = None):
        super().__init__(api_key, base_url)

    async def complete(
        self,
        prompt: str,
        system: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> str:
        model = "gemini-1.5-pro"
        contents = []
        if system:
            contents.append({"role": "user", "parts": [{"text": system}]})
            contents.append({"role": "model", "parts": [{"text": "Understood."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        async with self._get_client() as client:
            response = await client.post(
                f"{self.base_url}/v1beta/models/{model}:generateContent?key={self.api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": contents,
                    "generationConfig": {
                        "maxOutputTokens": max_tokens,
                        "temperature": temperature,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                return "".join(part.get("text", "") for part in parts)
            return ""

    async def test_connection(self) -> dict:
        start = time.time()
        try:
            async with self._get_client() as client:
                response = await client.post(
                    f"{self.base_url}/v1beta/models/gemini-1.5-pro:generateContent?key={self.api_key}",
                    headers={"Content-Type": "application/json"},
                    json={
                        "contents": [{"role": "user", "parts": [{"text": "hi"}]}],
                        "generationConfig": {"maxOutputTokens": 10},
                    },
                )
                response.raise_for_status()
                latency_ms = int((time.time() - start) * 1000)
                return {
                    "success": True,
                    "provider": self.name,
                    "model": "gemini-1.5-pro",
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
