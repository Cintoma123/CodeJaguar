"""
Abstract provider interface for AI API providers.

Every provider must implement:
- complete(): Send a prompt and return the AI response
- test_connection(): Validate the API key works
"""

from abc import ABC, abstractmethod

import httpx


class BaseProvider(ABC):
    """Abstract base class for all AI providers."""

    name: str
    base_url: str

    def __init__(self, api_key: str, base_url: str | None = None):
        self.api_key = api_key
        if base_url is not None:
            self.base_url = base_url

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        system: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> str:
        """Send a prompt to the provider and return the response text."""
        ...

    @abstractmethod
    async def test_connection(self) -> dict:
        """Test the API key validity. Returns dict with success, model, latency_ms."""
        ...

    def _get_client(self) -> httpx.AsyncClient:
        """Create a new async HTTP client with default timeout."""
        return httpx.AsyncClient(timeout=120.0)
