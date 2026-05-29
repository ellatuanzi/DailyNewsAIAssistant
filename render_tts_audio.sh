#!/bin/zsh

set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 INPUT_TEXT OUTPUT_AUDIO [VOICE]" >&2
  exit 1
fi

input_file="$1"
output_file="$2"
voice="${3:-Flo (Chinese (China mainland))}"

if [[ ! -f "$input_file" ]]; then
  echo "Input file not found: $input_file" >&2
  exit 1
fi

if ! command -v say >/dev/null 2>&1; then
  echo "macOS 'say' is not available" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

spoken_text="$tmp_dir/spoken.txt"
aiff_file="$tmp_dir/out.aiff"

# Remove URLs and markdown-ish noise so the spoken result sounds natural.
perl -0pe '
  s{https?://\S+}{}g;
  s/来源：.*//g;
  s/^\s*[#>*-]+\s*//mg;
  s/[[:space:]]+\n/\n/g;
  s/\n{3,}/\n\n/g;
' "$input_file" > "$spoken_text"

say -v "$voice" -f "$spoken_text" -o "$aiff_file"

case "$output_file" in
  *.aiff|*.aif)
    mv "$aiff_file" "$output_file"
    ;;
  *.m4a)
    if command -v afconvert >/dev/null 2>&1; then
      if afconvert "$aiff_file" -o "$output_file" -f m4af; then
        :
      else
        echo "m4a conversion failed; try an .aiff output path instead" >&2
        exit 1
      fi
    else
      echo "macOS 'afconvert' is not available; use an .aiff output path instead" >&2
      exit 1
    fi
    ;;
  *)
    echo "Unsupported output extension. Use .aiff or .m4a" >&2
    exit 1
    ;;
esac

echo "$output_file"
