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
        super().__init__(api_key, self.normalize_base_url(base_url))
        self.model = model

    @staticmethod
    def normalize_base_url(base_url: str) -> str:
        """Strip a trailing /chat/completions if the user pasted the full
        endpoint URL.

        e.g. https://openrouter.ai/api/v1/chat/completions
          -> https://openrouter.ai/api/v1
        """
        normalized = base_url.rstrip("/")
        if normalized.endswith("/chat/completions"):
            normalized = normalized[: -len("/chat/completions")]
        return normalized

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
                # If the model is "default", try to discover a real model.
                # Note: /models may list models that don't support
                # /chat/completions; we pick the first and rely on the
                # raise_for_status below to surface an incompatible-model error.
                model = self.model
                if model == "default":
                    try:
                        models_resp = await client.get(
                            f"{self.base_url}/models",
                            headers={"Authorization": f"Bearer {self.api_key}"},
                        )
                        if models_resp.status_code == 200:
                            models_data = models_resp.json()
                            if isinstance(models_data, dict) and "data" in models_data:
                                available = [
                                    m["id"]
                                    for m in models_data["data"]
                                    if "id" in m
                                ]
                                if available:
                                    model = available[0]
                                    # Cache so later calls skip re-discovery
                                    self.model = model
                    except Exception:
                        pass  # Fall through with "default"

                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": "hi"}],
                        "max_tokens": 10,
                    },
                )
                response.raise_for_status()
                latency_ms = int((time.time() - start) * 1000)
                return {
                    "success": True,
                    "provider": self.name,
                    "model": model,
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
