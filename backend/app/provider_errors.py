"""
Provider error normalization.

Translates the raw exceptions raised while talking to an AI provider
(httpx network/HTTP errors, config ValueErrors) into short, actionable
messages that are safe to surface to the user. Keeps API keys and stack
traces out of the returned strings.
"""

import httpx


def describe_provider_error(exc: Exception) -> str:
    """Return a concise, user-facing description of a provider failure."""
    # Configuration problems (e.g. unknown provider, missing base_url).
    if isinstance(exc, ValueError):
        return str(exc)

    # HTTP responses from the provider with a status code.
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        if code in (401, 403):
            return (
                f"Authentication failed (HTTP {code}). The API key was rejected "
                "— check that it is correct and has access to this model."
            )
        if code == 404:
            return (
                "Provider returned 404 — the model or endpoint was not found. "
                "Check the model name and base URL."
            )
        if code == 429:
            return (
                "Rate limited by the provider (HTTP 429). Wait a moment and try "
                "again, or check your plan's quota."
            )
        if code == 400:
            return (
                "Provider rejected the request (HTTP 400). The prompt may be too "
                "large for this model, or the model name may be invalid."
            )
        if code >= 500:
            return f"The provider had a server error (HTTP {code}). Try again shortly."
        return f"Provider returned HTTP {code}."

    # Network-level failures (no usable HTTP response).
    if isinstance(exc, httpx.ConnectError):
        return (
            "Could not connect to the provider. Check your network connection "
            "and the base URL."
        )
    if isinstance(exc, httpx.TimeoutException):
        return "The provider request timed out. The input may be too large, or the provider is slow."
    if isinstance(exc, httpx.HTTPError):
        return f"Network error talking to the provider: {exc}"

    # Anything else — fall back to the message without leaking a stack trace.
    return f"Unexpected error calling the provider: {exc}"
