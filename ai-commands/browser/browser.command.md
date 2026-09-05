# browser.command

## Tags

#command #ai-command #browser

Use when you need to open one or more URLs in a local browser.

## Usage

- `./commands/browser/browser.command.sh <url1> <url2> ...`
- `./commands/browser/browser.command.sh --file <path>` (one URL per line; blank lines and lines starting with `#` are ignored)

## Config

- `commands/browser/browser.command.conf` (see example template)

## Notes

- The script prints each URL and attempts to open it with `xdg-open` or `open`.
- If no opener is available, it will print the URLs to open manually.
- This command is safe to use with many links at once.

## Roles selection

- dev
- qa (if user for manual testing)

## Input

- url to open, see [browser.command.sh](browser.command.sh)

## Output

- node
