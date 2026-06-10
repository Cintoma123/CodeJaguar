"""
API routes for all endpoints.

The API key is always passed via the X-Provider-Key header — never in the request body.
"""

from fastapi import APIRouter, Header

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
    )
    return SecurityResponse(**result)


@router.post("/architecture", response_model=ArchitectureResponse)
async def architecture_review(
    body: ArchitectureRequest,
    x_provider_key: str = Header(..., alias="X-Provider-Key"),
) -> ArchitectureResponse:
    """Run an architecture review."""
    # Placeholder — will be wired in Week 3
    return ArchitectureResponse(
        findings=[],
        improvements=[],
        recommendations="",
        provider_used=body.provider,
    )


@router.post("/summary", response_model=SummaryResponse)
async def summary(
    body: SummaryRequest,
    x_provider_key: str = Header(..., alias="X-Provider-Key"),
) -> SummaryResponse:
    """Generate a PR summary."""
    # Placeholder — will be wired in Week 3
    return SummaryResponse(
        markdown="",
        provider_used=body.provider,
    )


@router.get("/health")
async def health_check():
    """Health check endpoint for the CLI backend lifecycle manager."""
    return {"status": "ok"}
