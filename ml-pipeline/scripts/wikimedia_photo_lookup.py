"""
wikimedia_photo_lookup.py
--------------------------
Downloads one photo per destination from Wikimedia/Wikipedia and saves the
actual image locally.

The application will then use the LOCAL images instead of requesting
Wikimedia every time a user opens the app.

Images:
    C:\\Users\\U.S.A Trader\\ml-pipeline\\data\\processed\\destination_images

CSV:
    C:\\Users\\U.S.A Trader\\ml-pipeline\\data\\processed\\destination_photos.csv

Run:
    python scripts/wikimedia_photo_lookup.py
"""

import re
import time
from pathlib import Path
from urllib.parse import quote

import pandas as pd
import requests


# ============================================================
# PATHS
# ============================================================

BASE_PROCESSED_PATH = Path(
    r"C:\Users\U.S.A Trader\ml-pipeline\data\processed"
)

DESTINATIONS_PATH = BASE_PROCESSED_PATH / "destinations_clean.csv"
OUTPUT_PATH = BASE_PROCESSED_PATH / "destination_photos.csv"

# Folder where the actual images will be stored.
IMAGE_DIR = BASE_PROCESSED_PATH / "destination_images"


# ============================================================
# WIKIMEDIA SETTINGS
# ============================================================

# IMPORTANT:
# Replace your-email@example.com with your actual contact email.
HEADERS = {
    "User-Agent": (
        "RouteLinkApp/1.0 "
        "(university/hackathon project; "
        "contact: arishaaif47@gmail.com)"
    )
}

# We deliberately use a slower delay because this is a one-time
# preparation process, NOT something the user waits for.
REQUEST_DELAY_SECONDS = 40.0

# If Wikimedia temporarily blocks/rate-limits us, retry.
MAX_RETRIES = 5

# First retry waits 5 seconds.
# Subsequent retries use exponential backoff:
# 5 -> 10 -> 20 -> 40 -> ...
INITIAL_BACKOFF_SECONDS = 5


# HTTP status codes that can be temporary.
RETRYABLE_STATUS_CODES = {
    429,  # Too Many Requests
    500,
    502,
    503,
    504,
}


# ============================================================
# CATEGORY FALLBACKS
# ============================================================

CATEGORY_FALLBACK_QUERIES = {
    "waterfall": "Waterfall",
    "valley": "Valley",
    "lake": "Lake",
    "mountainous": "Mountain range",
    "mosque": "Mosque",
    "national park": "National park",
    "coastal": "Coast",
    "museum": "Museum",
    "hill station": "Hill station",
    "fort": "Fortification",
    "monument": "Monument",
    "resort": "Resort",
    "island": "Island",
    "temple": "Hindu temple",
    "mine": "Mining",
    "desert": "Desert",
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def safe_filename(name: str) -> str:
    """
    Turn a destination name into a safe filename.

    Example:
        "Ansoo Lake" -> "ansoo_lake"
        "Mohenjo-daro" -> "mohenjo_daro"
    """

    name = str(name).strip().lower()

    # Remove characters that are unsafe/unnecessary in filenames.
    name = re.sub(r"[^\w\s-]", "", name, flags=re.UNICODE)

    # Convert spaces and repeated hyphens into underscores.
    name = re.sub(r"[\s-]+", "_", name)

    return name.strip("_") or "destination"


def extension_from_url(
    url: str,
    content_type: str = ""
) -> str:
    """
    Determine a suitable image extension.
    """

    content_type = content_type.lower()

    if "jpeg" in content_type or "jpg" in content_type:
        return ".jpg"

    if "png" in content_type:
        return ".png"

    if "webp" in content_type:
        return ".webp"

    if "gif" in content_type:
        return ".gif"

    # If Content-Type wasn't useful, inspect the URL.
    clean_url = url.split("?", 1)[0].lower()

    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        if clean_url.endswith(ext):
            if ext == ".jpeg":
                return ".jpg"
            return ext

    # Most Wikimedia photos will be JPEG.
    return ".jpg"


# ============================================================
# REQUEST FUNCTION WITH RATE-LIMIT HANDLING
# ============================================================

def request_with_backoff(
    url: str,
    *,
    params: dict | None = None,
    stream: bool = False,
):
    """
    Make a request while handling Wikimedia rate limits.

    If Wikimedia returns HTTP 429, the script waits and tries again.

    This prevents the whole program from crashing just because Wikimedia
    temporarily says "Too Many Requests".
    """

    for attempt in range(1, MAX_RETRIES + 1):

        try:

            response = requests.get(
                url,
                headers=HEADERS,
                params=params,
                timeout=20,
                stream=stream,
            )

            # ------------------------------------------------
            # SUCCESS
            # ------------------------------------------------

            if response.status_code == 200:
                return response

            # ------------------------------------------------
            # TEMPORARY FAILURE / RATE LIMIT
            # ------------------------------------------------

            if response.status_code in RETRYABLE_STATUS_CODES:

                if attempt == MAX_RETRIES:

                    print(
                        f"    [warning] Giving up after "
                        f"{MAX_RETRIES} attempts "
                        f"(HTTP {response.status_code})"
                    )

                    return None

                # Wikimedia may tell us exactly how long to wait.
                retry_after = response.headers.get(
                    "Retry-After"
                )

                try:
                    wait_seconds = float(retry_after)

                except (TypeError, ValueError):

                    wait_seconds = (
                        INITIAL_BACKOFF_SECONDS
                        * (2 ** (attempt - 1))
                    )

                # Never retry immediately.
                wait_seconds = max(
                    wait_seconds,
                    INITIAL_BACKOFF_SECONDS
                )

                print(
                    f"    [rate-limit/server] "
                    f"HTTP {response.status_code}; "
                    f"waiting {wait_seconds:.1f}s "
                    f"before retry "
                    f"({attempt}/{MAX_RETRIES})..."
                )

                time.sleep(wait_seconds)

                continue

            # ------------------------------------------------
            # PERMANENT/UNEXPECTED FAILURE
            # ------------------------------------------------

            print(
                f"    [warning] HTTP "
                f"{response.status_code} for {url}"
            )

            return None

        except requests.RequestException as exc:

            if attempt == MAX_RETRIES:

                print(
                    f"    [warning] Request failed after "
                    f"{MAX_RETRIES} attempts: {exc}"
                )

                return None

            wait_seconds = (
                INITIAL_BACKOFF_SECONDS
                * (2 ** (attempt - 1))
            )

            print(
                f"    [warning] Request error: {exc}; "
                f"waiting {wait_seconds:.1f}s before retry..."
            )

            time.sleep(wait_seconds)

    return None


# ============================================================
# WIKIPEDIA SEARCH
# ============================================================

def find_best_page_title(
    query: str,
    bias_pakistan: bool = True
):
    """
    Search Wikipedia for the best matching page title.
    """

    search_url = "https://en.wikipedia.org/w/api.php"

    if bias_pakistan:
        search_query = f"{query} Pakistan"
    else:
        search_query = query

    params = {
        "action": "query",
        "list": "search",
        "srsearch": search_query,
        "format": "json",
        "srlimit": 1,
    }

    response = request_with_backoff(
        search_url,
        params=params
    )

    if response is None:
        return None

    try:

        results = response.json().get(
            "query",
            {}
        ).get(
            "search",
            []
        )

    except ValueError:

        print(
            f"    [warning] Invalid JSON while searching "
            f"for '{query}'"
        )

        return None

    if not results:
        return None

    return results[0]["title"]


# ============================================================
# GET IMAGE URL FROM WIKIPEDIA
# ============================================================

def get_photo_url(
    place_name: str,
    bias_pakistan: bool = True
):
    """
    Find a Wikipedia page and extract its original image URL.

    Returns:
        (image_url, matched_wikipedia_title)
    """

    best_title = find_best_page_title(
        place_name,
        bias_pakistan=bias_pakistan
    )

    if not best_title:
        return None, None

    # Safely encode the Wikipedia title.
    encoded_title = quote(
        best_title.replace(" ", "_"),
        safe="()_:/"
    )

    summary_url = (
        "https://en.wikipedia.org/api/rest_v1/"
        f"page/summary/{encoded_title}"
    )

    # Wait between requests.
    time.sleep(REQUEST_DELAY_SECONDS)

    response = request_with_backoff(
        summary_url
    )

    if response is None:
        return None, best_title

    try:

        data = response.json()

    except ValueError:

        print(
            f"    [warning] Invalid JSON for "
            f"Wikipedia page '{best_title}'"
        )

        return None, best_title

    original_image = data.get(
        "originalimage"
    )

    if not original_image:
        return None, best_title

    image_url = original_image.get(
        "source"
    )

    if not image_url:
        return None, best_title

    return image_url, best_title


# ============================================================
# DOWNLOAD IMAGE LOCALLY
# ============================================================

def download_image(
    image_url: str,
    destination_name: str
):
    """
    Download the actual image into IMAGE_DIR.

    Returns a relative path such as:

        destination_images/ansoo_lake.jpg

    This is the path that your application will eventually use.
    """

    IMAGE_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    filename_base = safe_filename(
        destination_name
    )

    # Temporary file prevents a partially downloaded image
    # from being treated as a completed image.
    temp_path = IMAGE_DIR / (
        f".{filename_base}.download"
    )

    # Remove any old incomplete download.
    temp_path.unlink(
        missing_ok=True
    )

    print(
        f"    [download] Getting image..."
    )

    response = request_with_backoff(
        image_url,
        stream=True
    )

    if response is None:
        return None

    extension = extension_from_url(
        image_url,
        response.headers.get(
            "Content-Type",
            ""
        )
    )

    final_path = IMAGE_DIR / (
        f"{filename_base}{extension}"
    )

    # If the image already exists, don't download it.
    if (
        final_path.exists()
        and final_path.stat().st_size > 0
    ):

        print(
            f"    [skip download] "
            f"{final_path.name} already exists"
        )

        return (
            f"destination_images/"
            f"{final_path.name}"
        )

    try:

        with open(
            temp_path,
            "wb"
        ) as image_file:

            for chunk in response.iter_content(
                chunk_size=64 * 1024
            ):

                if chunk:
                    image_file.write(chunk)

        # Make sure something was actually downloaded.
        if (
            not temp_path.exists()
            or temp_path.stat().st_size == 0
        ):

            print(
                "    [warning] Downloaded file is empty."
            )

            temp_path.unlink(
                missing_ok=True
            )

            return None

        # Rename temporary file to final filename.
        temp_path.replace(
            final_path
        )

        print(
            f"    [saved] {final_path.name}"
        )

        # IMPORTANT:
        # This is a relative path, so it can work in your
        # website after deployment.
        return (
            f"destination_images/"
            f"{final_path.name}"
        )

    except OSError as exc:

        print(
            f"    [warning] Could not save image: {exc}"
        )

        temp_path.unlink(
            missing_ok=True
        )

        return None


# ============================================================
# CATEGORY FALLBACK
# ============================================================

def get_category_fallback_photo(
    category: str,
    fallback_cache: dict
):
    """
    Get one generic category image and download it only once.

    Example:

        waterfall -> one generic waterfall image

    Every destination needing a waterfall fallback can then
    reuse that same local image.
    """

    if category in fallback_cache:
        return fallback_cache[category]

    query = CATEGORY_FALLBACK_QUERIES.get(
        category
    )

    if not query:

        print(
            f"    [warning] No fallback query defined "
            f"for category '{category}'"
        )

        result = (None, None)

        fallback_cache[category] = result

        return result

    time.sleep(
        REQUEST_DELAY_SECONDS
    )

    image_url, matched_title = get_photo_url(
        query,
        bias_pakistan=False
    )

    if not image_url:

        result = (
            None,
            matched_title
        )

        fallback_cache[category] = result

        return result

    # Download only ONE copy for this category.
    local_path = download_image(
        image_url,
        f"fallback_{safe_filename(category)}"
    )

    if local_path:

        result = (
            local_path,
            matched_title
        )

    else:

        result = (
            None,
            matched_title
        )

    fallback_cache[category] = result

    return result


# ============================================================
# LOAD EXISTING CSV
# ============================================================

def load_existing_results(
    path: Path
):
    """
    Load an existing CSV.

    This makes the process resumable.
    """

    try:

        return pd.read_csv(
            path
        )

    except FileNotFoundError:

        return pd.DataFrame(
            columns=[
                "name",
                "category",
                "photo_url",
                "source",
                "matched_wiki_title",
                "original_wikimedia_url",
            ]
        )


# ============================================================
# SAVE PROGRESS
# ============================================================

def save_progress(
    results: list,
    output_path: Path
):
    """
    Save progress immediately.

    If the script stops at destination 30,
    destinations 1-30 remain saved.
    """

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    pd.DataFrame(
        results
    ).to_csv(
        output_path,
        index=False
    )


# ============================================================
# MAIN PIPELINE
# ============================================================

def run_photo_pipeline(
    destinations_path: Path = DESTINATIONS_PATH,
    output_path: Path = OUTPUT_PATH
):

    # --------------------------------------------------------
    # Check input
    # --------------------------------------------------------

    if not destinations_path.exists():

        raise FileNotFoundError(
            f"Could not find destinations file:\n"
            f"{destinations_path}"
        )

    # --------------------------------------------------------
    # Create image folder
    # --------------------------------------------------------

    IMAGE_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Load destinations
    # --------------------------------------------------------

    destinations_df = pd.read_csv(
        destinations_path
    )

    # --------------------------------------------------------
    # Load previous progress
    # --------------------------------------------------------

    existing = load_existing_results(
        output_path
    )

    existing_by_name = {}

    if (
        not existing.empty
        and "name" in existing.columns
    ):

        for _, row in existing.iterrows():

            existing_by_name[
                str(row["name"]).lower()
            ] = row.to_dict()

    # --------------------------------------------------------
    # Determine which destinations already have local images
    # --------------------------------------------------------

    already_done = set()

    if (
        not existing.empty
        and "photo_url" in existing.columns
    ):

        for _, row in existing.iterrows():

            local_path = str(
                row.get(
                    "photo_url",
                    ""
                )
            ).strip()

            # Ignore old Wikimedia URLs.
            if (
                local_path
                and not local_path.startswith(
                    "http://"
                )
                and not local_path.startswith(
                    "https://"
                )
            ):

                filename = local_path.replace(
                    "destination_images/",
                    "",
                    1
                )

                local_file = (
                    IMAGE_DIR / filename
                )

                if (
                    local_file.exists()
                    and local_file.stat().st_size > 0
                ):

                    already_done.add(
                        str(
                            row["name"]
                        ).lower()
                    )

    # --------------------------------------------------------
    # Print startup information
    # --------------------------------------------------------

    print("=" * 60)
    print("WIKIMEDIA LOCAL PHOTO PIPELINE")
    print("=" * 60)

    print(
        f"Loaded {len(destinations_df)} destinations."
    )

    print(
        f"{len(already_done)} already have "
        f"downloaded local images."
    )

    print(
        f"\nImages will be saved to:\n"
        f"{IMAGE_DIR}"
    )

    print(
        f"\nCSV will be saved to:\n"
        f"{output_path}\n"
    )

    # --------------------------------------------------------
    # Fallback cache
    # --------------------------------------------------------

    fallback_cache = {}

    # --------------------------------------------------------
    # Process every destination
    # --------------------------------------------------------

    results = []

    for index, row in destinations_df.iterrows():

        name = str(
            row["name"]
        )

        category = str(
            row["category"]
        )

        # ----------------------------------------------------
        # Already downloaded
        # ----------------------------------------------------

        if name.lower() in already_done:

            print(
                f"[skip] {name} "
                f"(local image already exists)"
            )

            results.append(
                existing_by_name[
                    name.lower()
                ]
            )

            continue

        # ----------------------------------------------------
        # Progress
        # ----------------------------------------------------

        print()
        print(
            f"[{index + 1}/{len(destinations_df)}] "
            f"{name} ({category})"
        )

        # ----------------------------------------------------
        # Direct Wikipedia search
        # ----------------------------------------------------

        time.sleep(
            REQUEST_DELAY_SECONDS
        )

        original_url, matched_title = (
            get_photo_url(
                name,
                bias_pakistan=True
            )
        )

        local_path = None

        # ----------------------------------------------------
        # Download direct image
        # ----------------------------------------------------

        if original_url:

            local_path = download_image(
                original_url,
                name
            )

        # ----------------------------------------------------
        # DIRECT SUCCESS
        # ----------------------------------------------------

        if local_path:

            print(
                f"    [direct] {matched_title}"
            )

            result = {
                "name": name,
                "category": category,
                "photo_url": local_path,
                "source": "wikipedia_exact",
                "matched_wiki_title": matched_title,
                "original_wikimedia_url": original_url,
            }

        # ----------------------------------------------------
        # FALLBACK
        # ----------------------------------------------------

        else:

            print(
                "    [direct] No usable image."
            )

            print(
                "    [fallback] Trying category image..."
            )

            local_path, fallback_title = (
                get_category_fallback_photo(
                    category,
                    fallback_cache
                )
            )

            if local_path:

                print(
                    f"    [fallback] {fallback_title}"
                )

                result = {
                    "name": name,
                    "category": category,
                    "photo_url": local_path,
                    "source": "category_fallback",
                    "matched_wiki_title": fallback_title,
                    "original_wikimedia_url": None,
                }

            # ------------------------------------------------
            # NOTHING FOUND
            # ------------------------------------------------

            else:

                print(
                    "    [MISSING] "
                    "No direct or fallback image found."
                )

                result = {
                    "name": name,
                    "category": category,
                    "photo_url": None,
                    "source": "none",
                    "matched_wiki_title": matched_title,
                    "original_wikimedia_url": original_url,
                }

        # ----------------------------------------------------
        # Add result
        # ----------------------------------------------------

        results.append(
            result
        )

        # ----------------------------------------------------
        # SAVE IMMEDIATELY
        # ----------------------------------------------------

        save_progress(
            results,
            output_path
        )

    # --------------------------------------------------------
    # Final save
    # --------------------------------------------------------

    results_df = pd.DataFrame(
        results
    )

    save_progress(
        results,
        output_path
    )

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("PHOTO PIPELINE COMPLETE")
    print("=" * 60)

    print(
        f"\nCSV:\n{output_path}"
    )

    print(
        f"\nImages:\n{IMAGE_DIR}"
    )

    if not results_df.empty:

        print(
            "\n--- Summary ---"
        )

        print(
            results_df[
                "source"
            ].value_counts()
            .rename(
                {
                    "wikipedia_exact":
                        "direct match",
                    "category_fallback":
                        "category fallback",
                    "none":
                        "no photo",
                }
            )
            .to_string()
        )

        exact_matches = (
            results_df[
                results_df["source"]
                == "wikipedia_exact"
            ]
        )

        print(
            f"\n{len(exact_matches)} of "
            f"{len(results_df)} destinations "
            f"got a direct Wikipedia image."
        )

        if not exact_matches.empty:

            print(
                "\nDestination -> Wikipedia "
                "matches:"
            )

            print(
                exact_matches[
                    [
                        "name",
                        "matched_wiki_title",
                        "photo_url",
                    ]
                ].to_string(
                    index=False
                )
            )

        fallback_matches = (
            results_df[
                results_df["source"]
                == "category_fallback"
            ]
        )

        if not fallback_matches.empty:

            print(
                f"\n{len(fallback_matches)} "
                f"destination(s) use a "
                f"generic category fallback."
            )

        missing = (
            results_df[
                results_df["source"]
                == "none"
            ]
        )

        if not missing.empty:

            print(
                f"\n{len(missing)} "
                f"destination(s) have NO image."
            )

            print(
                missing[
                    ["name", "category"]
                ].to_string(
                    index=False
                )
            )

    return results_df


# ============================================================
# START SCRIPT
# ============================================================

if __name__ == "__main__":
    run_photo_pipeline()

