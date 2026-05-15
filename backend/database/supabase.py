import os

from supabase import Client, create_client

PLACEHOLDER_VALUES = {
    "your-supabase-url",
    "your-supabase-service-key",
}


class SupabaseConfigurationError(RuntimeError):
    pass


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    service_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

    if not url or not service_key or url in PLACEHOLDER_VALUES or service_key in PLACEHOLDER_VALUES:
        raise SupabaseConfigurationError("Missing Supabase configuration")

    return create_client(url, service_key)
