#!/usr/bin/env python3
import os
import sys

def is_valid_chromium_char(cp):
    # Chromium extensions/common/file_util.cc -> base::IsStringUTF8 -> IsValidCharacter
    if cp < 0xD800:
        return True
    if cp <= 0xDFFF:
        return False
    if cp > 0x10FFFF:
        return False
    if 0xFDD0 <= cp <= 0xFDEF:
        return False
    if (cp & 0xFFFE) == 0xFFFE:
        return False
    return True

def sanitize_file(file_path):
    with open(file_path, "r", encoding="utf-8", errors="surrogatepass") as f:
        content = f.read()

    changed = False
    output = []
    for ch in content:
        cp = ord(ch)
        if is_valid_chromium_char(cp):
            output.append(ch)
        else:
            changed = True
            if cp <= 0xFFFF:
                output.append(f"\\u{cp:04x}")
            else:
                output.append(f"\\u{{{cp:x}}}")

    if changed:
        new_content = "".join(output)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"[Sanitize UTF-8] Fixed non-character codepoints in {file_path}")

def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "dist"
    print(f"[Sanitize UTF-8] Checking {target_dir} for Chromium UTF-8 compliance...")
    for root, _, files in os.walk(target_dir):
        for file in files:
            if file.endswith((".js", ".json", ".html", ".css")):
                p = os.path.join(root, file)
                sanitize_file(p)
    print(f"[Sanitize UTF-8] Finished checking {target_dir}")

if __name__ == "__main__":
    main()
