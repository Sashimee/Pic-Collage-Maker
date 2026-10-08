# Pic Collage Maker — FAQ

See the [User Guide](user-guide.md) for a full walkthrough.

## Are my photos uploaded anywhere?

No. Import, editing, filters, the AI tools and export all run in your browser.
Photos and projects are stored on your device in IndexedDB. The only outbound
requests are a same-site check for a new app version and an anonymous,
cookieless visit count.

## How do I turn off the visit count?

Turn off **Settings → General → Anonymous usage counts**. The count is also
never sent when your browser sends Do Not Track or Global Privacy Control.

## Will I lose my work if I close the tab?

The current board is saved in your browser shortly after each change and
restored when you come back. Once your work is a named project (**Save** or the
**Projects** screen), it is saved automatically after the delay set in
**Settings → Autosave after** (1.5 s by default), and again when you switch
away from the tab.

Undo history is not kept across reloads. For an open project, the **History**
tab's **Version History** keeps up to 20 snapshots of the current page.

## Can the browser delete my projects?

It can, if the device runs low on space and the browser hasn't granted
persistent storage. The **Projects** screen shows how much space your projects
use and whether they are kept until you delete them. The app asks for
persistent storage when you save a project yourself. To keep a copy outside the
browser, use **Export → Save as .piccollage**.

## How do I move a project to another device?

Use **Export → Save as .piccollage**, copy the file to the other device, then
use **Export → Open .piccollage** there. The file contains your photos.

Note: a `.piccollage` file currently contains only the page you are looking
at. For a multi-page project, save each page you need.

## Does it work offline?

Yes, once the app has loaded. Installing it to your home screen (Share → **Add
to Home Screen** on iPhone, browser menu → **Install app** on Android) makes it
open full screen like an app.

## Why was my HEIC photo skipped?

Not every browser can decode HEIC. When yours can't, the photo is skipped and
the app tells you so. Save the photo as JPEG first, or use Safari.

## What resolution are exported images?

PNG and JPG exports are twice the board size. A 1080 × 1350 board exports at
2160 × 2700 pixels. Photos are drawn from your full-resolution originals for
the export. The photo book renders every page at 300 DPI.

## How do I get all pages into one PDF?

Use **Export → Photo book (PDF)**. **Export PDF** contains only the current
page. **Download PNG** and **Download JPG** save one file per page.

## Do exported JPEGs contain my location?

No, by default. JPEG exports keep the first photo's EXIF data, but GPS location
is removed unless you turn on **Settings → General → Keep photo location**.

## How many steps can I undo?

Up to 60 steps. **Mod+Z** undoes and **Mod+Shift+Z** or **Mod+Y** redoes. The
**History** tab's **Steps** list lets you jump back several steps at once.

## How do I change the language?

The app starts in your browser's language if it is one of German, English,
Spanish, French, Italian or Portuguese, and in English otherwise. Change it
with the language menu in the header (on a phone: **Menu**) or in **Settings →
General → Language**. Your choice is remembered.
