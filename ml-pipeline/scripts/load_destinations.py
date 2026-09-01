"""
load_destinations.py
---------------------
Step 1 of the AI/ML pipeline: load the raw destinations CSV, clean it,
and save a processed version that the recommender will use.

Run: python scripts/load_destinations.py
"""

import pandas as pd

RAW_PATH = "data/raw/Tourist_Destinations.csv"
PROCESSED_PATH = "data/processed/destinations_clean.csv"

# The real Kaggle file uses different column names than our sample did.
# Rather than rewriting every line below, we rename columns once, right
# after loading, so the rest of the pipeline doesn't need to know or care
# what the original file called things. This "adapter" pattern is worth
# reusing -- it's how you keep messy source data from leaking its quirks
# into the rest of your code.
COLUMN_RENAME_MAP = {
    "_key": "name",
    "Desc": "description",
    "district": "province",
}


def load_raw_data(path: str) -> pd.DataFrame:
    """Read the CSV into a pandas DataFrame (basically a spreadsheet in memory)."""
    df = pd.read_csv(path)
    df = df.rename(columns=COLUMN_RENAME_MAP)
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns from {path}")
    return df


def inspect_data(df: pd.DataFrame) -> None:
    """Quick sanity checks before we trust the data."""
    print("\n--- Column types ---")
    print(df.dtypes)

    print("\n--- Missing values per column ---")
    print(df.isnull().sum())

    print("\n--- Unique categories ---")
    print(df["category"].unique())


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize text fields so later steps (like TF-IDF or category matching)
    don't get tripped up by inconsistent casing/whitespace.
    """
    df = df.copy()  # never mutate the original DataFrame in place -- avoids silent bugs
    df["name"] = df["name"].str.strip()
    df["category"] = df["category"].str.strip().str.lower()
    df["province"] = df["province"].str.strip().str.replace("−", "-", regex=False)
    df["description"] = df["description"].str.strip()

    # Drop any row missing essential fields -- a destination with no name/category is unusable
    before = len(df)
    df = df.dropna(subset=["name", "category", "latitude", "longitude"])
    after = len(df)
    if before != after:
        print(f"Dropped {before - after} rows with missing essential fields")

    return df


def add_hazard_prone_flag(df: pd.DataFrame) -> pd.DataFrame:
    """
    A simple rule-based feature: flag destinations whose description mentions
    hazard-related keywords. This isn't the NLP model yet -- it's a cheap
    heuristic we can ship on Day 1 while the real classifier is built later.
    """
    hazard_keywords = ["landslide", "flood", "closed", "closure", "avalanche", "snow"]
    pattern = "|".join(hazard_keywords)
    df["hazard_prone"] = df["description"].str.lower().str.contains(pattern, regex=True)
    return df


def main():
    df = load_raw_data(RAW_PATH)
    inspect_data(df)
    df = clean_data(df)
    df = add_hazard_prone_flag(df)

    print("\n--- Sample of cleaned data ---")
    print(df[["name", "category", "hazard_prone"]].head(10))

    df.to_csv(PROCESSED_PATH, index=False)
    print(f"\nSaved cleaned data to {PROCESSED_PATH}")


if __name__ == "__main__":
    main()
