"""
API routes for all endpoints.

The API key is always passed via the X-Provider-Key header — never in the request body.
"""

from fastapi import APIRouter, Header
from pydantic import BaseModel

from ..provider_manager import get_provider
from ..validators import (
    ArchitectureRequest,
    ArchitectureResponse,
    ProviderTestRequest,
    ProviderTestResponse,
    ReviewRequest,
    ReviewResponse,
    SecurityRequest,
    SecurityResponse,
    SecurityStats,
    SummaryRequest,
    SummaryResponse,
)

router = APIRouter()


class HealthResponse(BaseModel):
    status: str = "ok"


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint used by the CLI to verify the backend is running."""
    return HealthResponse()


@router.post("/providers/test", response_model=ProviderTestResponse)
async def test_provider(
    body: ProviderTestRequest,
    x_provider_key: str = Header(..., alias="X-Provider-Key"),
) -> ProviderTestResponse:
    """Test a provider's API key validity."""
    provider = get_provider(
        name=body.provider,
        api_key=x_provider_key,
        base_url=body.base_url,
        model=body.model,
    )
    result = await provider.test_connection()
    return ProviderTestResponse(**result)


@router.post("/review", response_model=ReviewResponse)
async def review_code(
    body: ReviewRequest,
    x_provider_key: str = Header(..., alias="X-Provider-Key"),
) -> ReviewResponse:
    """Run a code review on the provided diff/files."""
    from ..review.service import run_review

    result = await run_review(
        body=body,
        api_key=x_provider_key,
        base_url=body.base_url,
        model=body.model,
    )
    return ReviewResponse(**result)


@router.post("/security", response_model=SecurityResponse)
async def security_scan(
    body: SecurityRequest,
    x_provider_key: str = Header(..., alias="X-Provider-Key"),
) -> SecurityResponse:
    """Run a security scan on the provided files."""
    from ..security.service import run_security_scan

    result = await run_security_scan(
        body=body,
        api_key=x_provider_key,
        base_url=body.base_url,
        model=body.model,
    )
    return SecurityResponse(**result)


@router.post("/architecture", response_model=ArchitectureResponse)
async def architecture_review(
    body: ArchitectureRequest,
    x_provider_key: str = Header(..., alias="X-Provider-Key"),
) -> ArchitectureResponse:
    """Run an architecture review."""
    from ..architecture.service import run_architecture_review

    result = await run_architecture_review(
        body=body,
        api_key=x_provider_key,
        base_url=getattr(body, "base_url", None),
        model=getattr(body, "model", None),
    )
    return ArchitectureResponse(**result)


@router.post("/summary", response_model=SummaryResponse)
async def summary(
    body: SummaryRequest,
    x_provider_key: str = Header(..., alias="X-Provider-Key"),
) -> SummaryResponse:
    """Generate a PR summary."""
    from ..summary.service import run_summary

    result = await run_summary(
        body=body,
        api_key=x_provider_key,
        base_url=getattr(body, "base_url", None),
        model=getattr(body, "model", None),
    )
    return SummaryResponse(**result)
