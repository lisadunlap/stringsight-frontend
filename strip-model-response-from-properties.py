#!/usr/bin/env python3
"""
Strip model_response field from all properties.jsonl files in final_results directory.

This field is redundant since properties join to conversations via question_id,
and the large array format crashes backend serialization.
"""

import json
import os
from pathlib import Path

def strip_model_response_from_file(filepath: Path) -> tuple[int, int]:
    """
    Remove model_response field from each line in a JSONL file.

    Returns:
        (total_lines, lines_modified) tuple
    """
    temp_filepath = filepath.with_suffix('.jsonl.tmp')
    total_lines = 0
    lines_modified = 0

    # Use utf-8 with error handling for files with encoding issues
    with open(filepath, 'r', encoding='utf-8', errors='replace') as infile, \
         open(temp_filepath, 'w', encoding='utf-8') as outfile:
        for line in infile:
            total_lines += 1
            try:
                obj = json.loads(line)

                # Check if model_response exists
                if 'model_response' in obj:
                    del obj['model_response']
                    lines_modified += 1

                # Write modified line
                outfile.write(json.dumps(obj) + '\n')

            except json.JSONDecodeError as e:
                print(f"  ⚠️  Warning: Skipping malformed JSON on line {total_lines}: {e}")
                # Write original line as-is
                outfile.write(line)

    # Replace original file with modified version
    os.replace(temp_filepath, filepath)

    return (total_lines, lines_modified)


def main():
    # Find all properties.jsonl files in final_results subdirectories
    final_results_dir = Path.home() / 'StringSightNew' / 'final_results'

    if not final_results_dir.exists():
        print(f"❌ Error: Directory not found: {final_results_dir}")
        return

    print(f"🔍 Searching for properties.jsonl files in: {final_results_dir}\n")

    properties_files = list(final_results_dir.glob('*/properties.jsonl'))

    if not properties_files:
        print("❌ No properties.jsonl files found")
        return

    print(f"📁 Found {len(properties_files)} properties.jsonl files:\n")

    total_files = 0
    total_lines_processed = 0
    total_lines_modified = 0

    for filepath in sorted(properties_files):
        dataset_name = filepath.parent.name
        file_size_mb = filepath.stat().st_size / (1024 * 1024)

        print(f"📝 Processing: {dataset_name}/properties.jsonl ({file_size_mb:.1f} MB)")

        try:
            lines_total, lines_modified = strip_model_response_from_file(filepath)

            total_files += 1
            total_lines_processed += lines_total
            total_lines_modified += lines_modified

            new_size_mb = filepath.stat().st_size / (1024 * 1024)
            size_reduction_mb = file_size_mb - new_size_mb

            print(f"   ✅ Processed {lines_total:,} properties")
            print(f"   ✅ Removed model_response from {lines_modified:,} properties")
            print(f"   ✅ Size: {file_size_mb:.1f} MB → {new_size_mb:.1f} MB (saved {size_reduction_mb:.1f} MB)")
            print()

        except Exception as e:
            print(f"   ❌ Error processing file: {e}")
            print()

    print("=" * 60)
    print(f"✅ Summary:")
    print(f"   Files processed: {total_files}")
    print(f"   Total properties: {total_lines_processed:,}")
    print(f"   Properties modified: {total_lines_modified:,}")
    print()
    print("🎉 Done! All properties.jsonl files have been updated.")
    print()
    print("Next steps:")
    print("  1. Restart the backend API server to pick up the changes")
    print("  2. Test the properties endpoints:")
    print("     curl https://api.stringsight.com/results/telecom/properties?limit=5")
    print("     curl https://api.stringsight.com/results/drunk_at_a_party/properties?limit=5")


if __name__ == '__main__':
    main()
