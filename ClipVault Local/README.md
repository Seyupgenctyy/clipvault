# ClipVault Local

ClipVault Local is a privacy-focused Google Chrome extension that stores texts you copy locally. It allows you to manage your clipboard history without sending data to cloud services.

## Features

- **Automatic Text Capture**: Automatically saves text you copy
- **Local Storage**: All data is securely stored in Chrome's local storage without being sent to the cloud
- **Search**: Ability to search through saved texts
- **Favorites**: Mark important clips as favorites
- **Auto-Cleanup**: Automatically delete old clips after a specified time period
- **Full Control**: Turn monitoring on and off at any time

## Installation

1. Download this repository to your computer
2. Go to `chrome://extensions/` in your Chrome browser
3. Enable Developer mode (in the top right corner)
4. Click "Load unpacked" button
5. Select the downloaded folder

## Usage

1. After installing the extension, click on the ClipVault icon in the top right corner to access your clipboard history
2. Use the toggle in the interface to turn monitoring on and off
3. Use the search box to search through your clips
4. Click the star icon to add clips to favorites
5. Click the gear icon to access settings

## Privacy

This extension stores all data locally only. No data is sent or shared over the internet. All copied texts are stored only in your browser and can be completely deleted at any time.

## Settings

You can customize the following settings in the extension:

- Maximum number of clips
- Auto-delete period (in days)
- Manually clear all clips

## Permissions

This extension requires the following permissions:

- `clipboardRead`: To read clipboard content
- `storage`: To store clips and settings locally
- `scripting`: To run scripts on pages to detect copy operations
- `tabs`: To listen for copy operations in open tabs
- `<all_urls>`: Required to work on all pages

## Contributing

1. Fork this repository
2. Create a new branch (`git checkout -b new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin new-feature`)
5. Create a Pull Request 