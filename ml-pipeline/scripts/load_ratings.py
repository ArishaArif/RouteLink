"""
load_ratings.py
-----------------
Step 3 of the AI/ML pipeline: reshape the Google Travel Reviews dataset
into the "long format" that collaborative-filtering libraries (like
`surprise`) expect: one row per (user, item, rating), not one row per
user with 24 category columns.

Run: python scripts/load_ratings.py
"""

import pandas as pd

RAW_PATH = "data/raw/google_review_ratings.csv"
PROCESSED_PATH = "data/processed/ratings_long.csv"

# The 24 Google review categories, in order, based on the dataset's
# documentation (UCI: "Travel Review Ratings"). We map them onto category
# labels that resemble our Pakistan destination categories, so later we
# can connect "a user who rates Category 3 (~Beaches) highly" to
# "recommend destinations tagged coastal/lake" in our own catalog.
CATEGORY_LABELS = {
    "Category 1": "churches", "Category 2": "resorts", "Category 3": "beaches",
    "Category 4": "parks", "Category 5": "theatres", "Category 6": "museums",
    "Category 7": "malls", "Category 8": "zoo", "Category 9": "restaurants",
    "Category 10": "pubs_bars", "Category 11": "local_services",
    "Category 12": "burger_pizza", "Category 13": "hotels_other",
    "Category 14": "juice_bars", "Category 15": "art_galleries",
    "Category 16": "dance_clubs", "Category 17": "swimming_pools",
    "Category 18": "gyms", "Category 19": "bakeries", "Category 20": "beauty_spas",
    "Category 21": "cafes", "Category 22": "view_points", "Category 23": "monuments",
    "Category 24": "gardens",
}


def load_and_fix_dirty_values(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)

    # Drop the trailing unnamed column pandas creates from the file's
    # trailing comma -- an artifact of how the CSV was exported, not real data.
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]

    category_cols = [c for c in df.columns if c.startswith("Category")]

    # pd.to_numeric with errors="coerce" tries to convert each value to a
    # number; anything it can't parse (like our corrupted "2\t2." cell)
    # becomes NaN instead of crashing the whole script. This is the safe
    # way to force numeric types on real-world, occasionally-dirty data.
    for col in category_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=category_cols, how="any")
    print(f"Dropped {before - len(df)} rows with unparseable/missing ratings")

    return df, category_cols


def reshape_to_long_format(df: pd.DataFrame, category_cols: list) -> pd.DataFrame:
    """
    pandas' `melt` turns "wide" data (one row per user, many category
    columns) into "long" data (one row per user-category-rating triple).
    This is the format collaborative filtering expects, because it's
    really just a big list of (user, item, rating) facts -- exactly like
    a movie-ratings dataset, just with attraction categories instead of movies.
    """
    long_df = df.melt(
        id_vars=["User"],
        value_vars=category_cols,
        var_name="category_raw",
        value_name="rating",
    )
    long_df["category"] = long_df["category_raw"].map(CATEGORY_LABELS)
    long_df = long_df.drop(columns=["category_raw"])

    # A rating of exactly 0 in this dataset means "never rated," not
    # "rated it zero stars" -- keeping those would tell the model users
    # hate things they've simply never visited. We drop them.
    long_df = long_df[long_df["rating"] > 0]

    return long_df


def main():
    df, category_cols = load_and_fix_dirty_values(RAW_PATH)
    long_df = reshape_to_long_format(df, category_cols)

    print(f"\nReshaped into {len(long_df)} (user, category, rating) rows")
    print(long_df.head(10))
    print(f"\nRating range: {long_df['rating'].min()} to {long_df['rating'].max()}")

    long_df.to_csv(PROCESSED_PATH, index=False)
    print(f"\nSaved to {PROCESSED_PATH}")


if __name__ == "__main__":
    main()
