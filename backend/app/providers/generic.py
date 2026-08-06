"""
Generic OpenAI-compatible provider implementation.

Works with any provider that follows the OpenAI API spec:
- Ollama, Together AI, Groq, Mistral, LM Studio, vLLM, etc.
Auth: Authorization: Bearer <key>
Base URL: User-defined

The base URL is accepted in any form: with or without a trailing version
segment. `https://agentrouter.org` and `https://agentrouter.org/v1` both work —
requests are tried against the URL exactly as configured first, and fall back
to inserting `/v1` when the response looks like a wrong-path hit.
"""

import json
import re
import time

import httpx

from ..provider_errors import describe_provider_error
from .base import BaseProvider


def _extract_content(data: dict) -> str:
    """Pull the assistant message text out of an OpenAI-compatible response.

    Some OpenAI-compatible gateways return a 200 with a body that has no usable
    message content: an empty `choices` list, a `content` of `null` (model
    refusal / content filter), or a top-level `error` object instead of
    `choices`. Returning `None` here would crash the downstream `.strip()` with
    an opaque 500, so surface a clear, actionable message instead.
    """
    # A gateway may return a 200 whose body is actually an error envelope.
    if isinstance(data.get("error"), dict):
        msg = data["error"].get("message") or "unknown error"
        raise ValueError(f"The provider returned an error: {msg}")

    choices = data.get("choices")
    if not choices:
        raise ValueError(
            "The provider returned no choices. The model or base URL may be "
            "wrong, or the request was rejected upstream."
        )

    message = choices[0].get("message") or {}
    content = message.get("content")
    if content is None or content == "":
        finish = choices[0].get("finish_reason")
        # finish_reason == "length" means the model ran out of output tokens
        # before emitting any usable content — not a refusal. This is common
        # with tiny/free models (especially reasoning models that spend the
        # whole output budget on hidden reasoning). Point the user at the real
        # fix rather than a phantom content filter.
        if finish == "length":
            raise ValueError(
                "The model hit its output token limit before returning any "
                "content (finish_reason: length). This is common with small or "
                "free models — try a model with a larger output limit, or reduce "
                "the size of the diff being reviewed."
            )
        # Otherwise a null/empty content usually means a refusal or content filter.
        detail = f" (finish_reason: {finish})" if finish else ""
        raise ValueError(
            "The provider returned an empty response with no content"
            f"{detail}. The model may have refused the request or hit a "
            "content filter."
        )
    return content


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

    @staticmethod
    def _has_version_segment(base_url: str) -> bool:
        """True when the URL already contains a version path segment.

        e.g. https://agentrouter.org/v1       -> True
             https://agentrouter.org/v1beta   -> True
             https://agentrouter.org          -> False
        """
        return bool(re.search(r"/v\d", base_url.rstrip("/"), re.IGNORECASE))

    def _candidate_urls(self, path: str) -> list[str]:
        """Return the full request URLs to try, in order.

        The configured base URL is tried exactly as given. When it has no
        version segment (like `/v1`), a second candidate is generated with
        `/v1` inserted — so both `https://agentrouter.org` and
        `https://agentrouter.org/v1` resolve to the same endpoint.
        """
        base = self.base_url.rstrip("/")
        urls = [f"{base}{path}"]
        if not self._has_version_segment(base):
            urls.append(f"{base}/v1{path}")
        return urls

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _should_retry(self, error: Exception) -> bool:
        """Return True when the failure looks like a wrong-path response.

        A non-JSON body (an HTML page, say) or an HTTP 404 usually means the
        configured base URL is missing the `/v1` prefix and the fallback URL is
        worth trying. Genuine auth / rate-limit / server errors are never
        retried — masking them with a retry would confuse the real problem.
        """
        if isinstance(error, json.JSONDecodeError):
            return True
        if isinstance(error, httpx.HTTPStatusError):
            return error.response.status_code == 404
        return False

    async def _post_json(
        self,
        client: httpx.AsyncClient,
        path: str,
        payload: dict,
    ) -> dict:
        last_error: Exception | None = None
        for url in self._candidate_urls(path):
            try:
                response = await client.post(url, headers=self._headers(), json=payload)
                response.raise_for_status()
                return response.json()
            except Exception as e:  # noqa: BLE001 - final error re-raised below
                last_error = e
                if not self._should_retry(e):
                    raise
        raise last_error  # type: ignore[misc] - urls is never empty

    async def _get_json(
        self,
        client: httpx.AsyncClient,
        path: str,
    ) -> dict:
        last_error: Exception | None = None
        for url in self._candidate_urls(path):
            try:
                response = await client.get(url, headers=self._headers())
                response.raise_for_status()
                return response.json()
            except Exception as e:  # noqa: BLE001 - final error re-raised below
                last_error = e
                if not self._should_retry(e):
                    raise
        raise last_error  # type: ignore[misc] - urls is never empty

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
            data = await self._post_json(
                client,
                "/chat/completions",
                {
                    "model": self.model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            return _extract_content(data)

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
                        models_data = await self._get_json(client, "/models")
                        available = [
                            m["id"]
                            for m in models_data.get("data", [])
                            if "id" in m
                        ]
                        if available:
                            model = available[0]
                            # Cache so later calls skip re-discovery
                            self.model = model
                    except Exception:
                        pass  # Fall through with "default"

                await self._post_json(
                    client,
                    "/chat/completions",
                    {
                        "model": model,
                        "messages": [{"role": "user", "content": "hi"}],
                        "max_tokens": 10,
                    },
                )
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
                "error": describe_provider_error(e),
                "latency_ms": latency_ms,
            }
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000)
            return {
                "success": False,
                "provider": self.name,
                "error": describe_provider_error(e),
                "latency_ms": latency_ms,
            }
