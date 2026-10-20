# Userscripts for ChatGPT on the web

[简体中文](README.md) | **English**

<!-- README-SOURCE-SHA256: 6104282e3a203e5ac65d1ad96b56cef79c0e6e23f1f0c840291641602043a47b -->

This directory contains Tampermonkey userscripts for ChatGPT on the web.

> [!IMPORTANT]
> On Chrome 138 and later, open `chrome://extensions`, select **Details** for Tampermonkey, and enable **Allow User Scripts**. On Chrome versions earlier than 138, enable **Developer mode** on the Extensions page instead.

![The Allow User Scripts toggle on Chrome's extension details page](<附图1 需要开启“允许用户运行脚本”.png>)

## Scripts

| Script | What it does | Install |
| --- | --- | --- |
| [Default new ChatGPT conversations to Chat](./ChatGPT%20%E6%96%B0%E8%81%8A%E5%A4%A9%E9%BB%98%E8%AE%A4%E9%80%89%E6%8B%A9%E2%80%9C%E8%81%8A%E5%A4%A9%E2%80%9D.user.js) | Selects **Chat** when a regular new conversation opens, then stops interfering if you switch to **Work** manually. | [Install directly](https://raw.githubusercontent.com/RongNianXin/ChatGPT-Workflows/main/ChatGPT-Web/ChatGPT%20%E6%96%B0%E8%81%8A%E5%A4%A9%E9%BB%98%E8%AE%A4%E9%80%89%E6%8B%A9%E2%80%9C%E8%81%8A%E5%A4%A9%E2%80%9D.user.js) |
| [Resizable ChatGPT sidebar V2](./ChatGPT%20%E5%B7%A6%E4%BE%A7%E6%A0%8F%E8%87%AA%E7%94%B1%E6%8B%96%E5%8A%A8%E5%AE%BD%E5%BA%A6%20V2.user.js) | Lets you drag the right edge of the sidebar, saves the selected width, and restores the default width when you double-click the handle. | [Install directly](https://raw.githubusercontent.com/RongNianXin/ChatGPT-Workflows/main/ChatGPT-Web/ChatGPT%20%E5%B7%A6%E4%BE%A7%E6%A0%8F%E8%87%AA%E7%94%B1%E6%8B%96%E5%8A%A8%E5%AE%BD%E5%BA%A6%20V2.user.js) |

## Installation

### Install from this repository (recommended)

1. Install and enable Tampermonkey.
2. Select **Install directly** in the table above.
3. On Tampermonkey's confirmation page, review the script name, matched sites, and permissions, then select **Install**.
4. Reload ChatGPT.

If the direct link only shows source code, open the script's file page and select **Raw**. You can also create a new script in the Tampermonkey dashboard, paste the complete source, and save it.

### Install from a local file

1. Download the `.user.js` file.
2. Open `chrome://extensions`, select Tampermonkey's **Details**, and enable **Allow access to file URLs**.
3. Drag the `.user.js` file onto a Chrome page.
4. Confirm the installation in Tampermonkey, then reload ChatGPT.

## Usage

### Default new conversations to Chat

The script attempts to select **Chat** once on a regular new-conversation page. It does not keep forcing the mode after you open an existing conversation or switch to **Work** manually.

### Resizable sidebar

Move the pointer to the sidebar's right edge and drag the thin handle. The supported width is 200–650 pixels. The script saves the width when you release the pointer; double-click the handle to restore ChatGPT's current default width.

## Permissions and data

- Both scripts match only `https://chatgpt.com/*`; the sidebar script also supports `https://www.chatgpt.com/*`.
- Both use `@grant none` and request no privileged Tampermonkey APIs.
- Neither script sends network requests or reads cookies or account credentials.
- The sidebar script stores one width value in the browser's local storage for the ChatGPT origin.

## Troubleshooting

- The script does not run: confirm that the script is enabled and that Chrome's **Allow User Scripts** toggle is on.
- An install link only displays source: create a new script in the Tampermonkey dashboard, paste the complete source, and save it.
- A feature suddenly stops working: ChatGPT's page structure may have changed. Disable the script and check this repository for a later version.

## Maintainers: importing another Tampermonkey backup

A Tampermonkey ZIP export may contain every installed script together with options and stored data. Only process `.user.js` files for this public directory. Do not commit the backup ZIP, `.options.json`, or `.storage.json` files.

For repeat imports, do not rely on a maintainer's or an AI task's memory:

1. Match an existing script by `@namespace + @name`.
2. Compare it with the repository's `.user.js` file and skip unchanged scripts.
3. When the same script changed, update its existing file and increment `@version`.
4. Create a new file and README entry only for a genuinely new script.
5. A script missing from a later backup is not authorization to delete its repository copy; deletion requires a separate decision.

For example, if a later backup contains scripts 1, 2, and 3, scripts 1 and 2 are compared rather than duplicated, and only script 3 is added.

## Safety notes

- Read each userscript before installing it and verify its matched sites and permissions.
- Changes to ChatGPT's page structure may require a script update.
- This project is not affiliated with or endorsed by OpenAI, Google, or Tampermonkey.

## License

The scripts are released under this repository's [MIT License](../LICENSE).

## References

- [Tampermonkey: installing userscripts](https://www.tampermonkey.net/faq.php?q=Q102)
- [Tampermonkey: importing and exporting scripts](https://www.tampermonkey.net/faq.php?locale=en&q=Q106)
- [Chrome: enabling the User Scripts API](https://developer.chrome.com/docs/extensions/reference/api/userScripts)
