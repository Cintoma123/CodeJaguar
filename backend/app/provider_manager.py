"""
Provider selection and routing.

The provider manager is responsible for:
- Mapping provider names to provider classes
- Retrieving API keys from the request header
- Instantiating the correct provider with the key
"""

from .providers.anthropic import AnthropicProvider
from .providers.base import BaseProvider
from .providers.deepseek import DeepSeekProvider
from .providers.gemini import GeminiProvider
from .providers.generic import GenericProvider
from .providers.openai import OpenAIProvider

# Registry of built-in providers
PROVIDER_REGISTRY: dict[str, type[BaseProvider]] = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
    "deepseek": DeepSeekProvider,
}


def get_provider(
    name: str,
    api_key: str,
    base_url: str | None = None,
    model: str | None = None,
) -> BaseProvider:
    """
    Instantiate and return the correct provider.

    Args:
        name: Provider name (openai, anthropic, gemini, deepseek, or any custom name)
        api_key: The API key for the provider
        base_url: Optional custom base URL (used for generic providers)
        model: Optional model name (used for generic providers)

    Returns:
        An instance of BaseProvider

    Raises:
        ValueError: If the provider requires a base_url but none is provided
    """
    provider_class = PROVIDER_REGISTRY.get(name.lower())

    if provider_class is not None:
        if base_url:
            return provider_class(api_key=api_key, base_url=base_url)
        return provider_class(api_key=api_key)

    # Fallback to generic provider for any unknown provider name
    if not base_url:
        raise ValueError(
            f"Unknown provider '{name}'. Please provide a base_url for generic providers."
        )
    return GenericProvider(
        api_key=api_key,
        base_url=base_url,
        model=model or "default",
    )
